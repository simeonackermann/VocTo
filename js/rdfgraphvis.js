// the RDFGraphvis class
RDFGraphVis = function( settings ) {
	this.nquads = settings.data;
	this.id = settings.id;
	this.layoutFile = this.id + ".json";
	
	this.base = settings.base ? settings.base : null;
	this.prefixes = settings.prefixes ? settings.prefixes : {};

	this.state = {
		'editorMarks' : []
	};

	this.svg = null;
	this.svgGraph = null;
	//TODO: statusBar toggler
	//this.extendStatusBar = true;

	this.model = []; // store json-ls model
	this.graphModel = { "nodes" : [], "links" : [] }; // store nodes and links
	this.graphLayout = {}; // stored model-layout with xy-positions
	this.classProperties = {};

	this.force = null;
	this.zoom = true;
	
	this.init();
	return this;
}

// init the d3 graph svg, element and links
RDFGraphVis.prototype.init = function() {
	var _this = this;

	var docEl = document.documentElement;
	var bodyEl = document.getElementsByTagName('body')[0];

	// init graph
	var w = window.innerWidth || docEl.clientWidth || bodyEl.clientWidth;
	var h = window.innerHeight|| docEl.clientHeight|| bodyEl.clientHeight;	

	// init root svg, add zoom/pan g
	_this.svg = d3.select("#graph").append("svg:svg")
		.attr("width", w)
		.attr("height", h);
		/*
		.attr("pointer-events", "all")
		.append('svg:g')
		.call(d3.behavior.zoom().on("zoom", redraw))
		.append('svg:g');
		*/

	// define the arrow.
	var defs = _this.svg.append("svg:defs").selectAll("marker")
		.data(["endArrow"])      // Different link/path types can be defined here
		.enter().append("svg:marker")    // This section adds in the arrows
		.attr("id", String)
		.attr("viewBox", "0 -5 10 10")
		//.attr("refX", 18)
		.attr("refX", 8)
		.attr("refY", 0)
		.attr("markerWidth", 6)
		.attr("markerHeight", 6)
		.attr("orient", "auto")
		.append("svg:path")
		.attr("d", "M0,-5L10,0L0,5");

	// basic force layout
	_this.force = d3.layout.force()
		.gravity(.05)
		.charge(-100)
		.distance(100)
		.linkDistance( 100 )
		.size([w, h]);

	_this.svgGraph = _this.svg.append("g")	
		.attr("class", "this-graph");


	//d3.select(".this-graph")
      		//.attr("transform", "translate(" + d3.event.translate + ") scale(" + d3.event.scale + ")"); 

	// svg nodes and edges 
    //_this.svgLinks = _this.svgGraph.append("g").selectAll("g");
    //_this.svgNodes = _this.svgGraph.append("g").selectAll("g");		

    _this.drag = d3.behavior.drag()
          .origin(function(d){
            return {x: d.x, y: d.y};
          })          
          .on("drag", function(args){
            _this.state.justDragged = true;
            _this.dragmove.call(_this, args);
          })
          .on("dragend", function() {
            // todo check if edge-mode is selected
	});

	// listen for key events
	d3.select(window)
		.on("keydown", function(){
			svgKeyDown.call(_this);
		})
		.on("keyup", function(){
			svgKeyUp.call(_this);
	});
	_this.svg.on("mousedown", function(d){svgMouseDown.call(_this, d);});
	_this.svg.on("mouseup", function(d){svgMouseUp.call(_this, d);});          
	_this.svg.on("mouseover", function(d){ });          

	// listen for dragging
	var zoomSvg = d3.behavior.zoom()
		.on("zoom", function(){
			/* if (d3.event.sourceEvent.shiftKey){
				return false;
			} */
			zoomed.call(_this);
			return true;
		})
		.on("zoomstart", function(){ 
			_this.zoomStart = true;
			//if (!d3.event.sourceEvent.shiftKey) d3.select('body').style("cursor", "move");
		})
		.on("zoomend", function(){
			//d3.select('body').style("cursor", "auto");
	});

    _this.svg.call(zoomSvg).on("dblclick.zoom", null);        
	
	// listen for resize
    window.onresize = function(){updateWindow();};    

    _this.parse();

    // init interface actions
    _this.interface();	

	/* private init functions */
	//zoomed
	function zoomed() {
		if ( _this.zoom ) {			
			d3.select(".this-graph")
    			.attr("transform", "translate(" + d3.event.translate + ") scale(" + d3.event.scale + ")");
		}
	}

	function updateWindow() {
		var docEl = document.documentElement,
	        bodyEl = document.getElementsByTagName('body')[0];
	    var x = window.innerWidth || docEl.clientWidth || bodyEl.clientWidth;
	    var y = window.innerHeight|| docEl.clientHeight|| bodyEl.clientHeight;
	    _this.svg.attr("width", x).attr("height", y);

	    $( "#editor" ).height( window.innerHeight - $(".navbar").height() );
	    $(".CodeMirror").height( window.innerHeight - $(".navbar").height() );
	}

	function svgMouseDown() {
		$("#voc").hide();
        $("#history").hide();
		this.state.graphMouseDown = true;
		d3.select('body').style("cursor", "move");
	}

	function svgMouseUp() {
    	this.state.graphMouseDown = false;
    	$(".status-bar").hide();
    	d3.selectAll(".node").classed("selected", false);
    	d3.select('body').style("cursor", "auto");
  	}

	function svgKeyDown() {}

  	function svgKeyUp() {}
    

} // end of init

/*
Parse the model from the nquads-file to json (with jsonld). If exists get the stored graph-positions
*/
RDFGraphVis.prototype.parse = function(){
	var _this = this;
	// parse nquads to json
	jsonld.fromRDF(_this.nquads, {format: 'application/nquads'}, function(err, doc) {		
		_this.model = doc;
		if ( err ) {
			_this.setStatusMsg( err, "error");
			console.log("Error: ", err);
			return false;
		}
		console.log( "Model:  ", _this.model );
			
		// maybe get stored graph
		$.post( "ajax/get.php", { name: _this.layoutFile })		
			.done(function( jsondata ) {
				if ( jsondata.result && jsondata.content != "" ) {
					_this.graphLayout = $.parseJSON( jsondata.content );
				} 
				_this.createModel();
				_this.print();
		});
	});
} // end of parse

/*
Create our model from json object
*/
RDFGraphVis.prototype.createModel = function(){
	var _this  = this;

	var nodeIndexes = new Object();
	var tmpLinks = new Array();	

	// walk model
	$.each( _this.model, function(classI, element) {
		element["@d3"] = new Object();

		if ( ! element.hasOwnProperty("@type") ) {
			console.log("No @type in: ", element);
			_this.addStatusMsg("No attribute @type in element: " + JSON.stringify( element ) + "<br />It cannot added to the graph!", "warning");
			return true;
		}

		if ( ! element.hasOwnProperty("@id") ) {
			console.log("No @id in element: ", element);
			_this.addStatusMsg("No attribute @id in: " + JSON.stringify( element ) + "<br />It cannot added to the graph!", "warning");
			return true;
		}

		var label = basename( element["@id"] );
		/*if ( element.hasOwnProperty("http://www.w3.org/2000/01/rdf-schema#label") ) {
			label = element["http://www.w3.org/2000/01/rdf-schema#label"][0]["@value"];
		}*/

		element["@d3"].label = label;
		/*
		element["@d3"].attributes = {};
		$.each(element,function(key,val) {
			if ( key[0] != "@" ) {
				element["@d3"].attributes[key] = val;
			}
			//console.log("Class-Key-"+key+": ", val);
		});
		*/

		/*
		TODO: parse every types
		$.each( element["@type"], function( typeKey, type ) {

		});
		*/

		switch( element["@type"][0] ) {
			case "http://www.w3.org/2002/07/owl#Ontology":
				// do nothing...
				/*element["@d3"].type = "Model";*/
				break;

			// add a class
			case "http://www.w3.org/2000/01/rdf-schema#Class":
			case "http://www.w3.org/2002/07/owl#Class":

				element["@d3"].type = "Class";

				// maybe merge existing position
				if ( _this.graphLayout.hasOwnProperty(element["@id"]) ) {
					element.x = _this.graphLayout[ element["@id"] ].x;
					element.y = _this.graphLayout[ element["@id"] ].y;
				}

				// maybe add as subclass
				if ( element.hasOwnProperty("http://www.w3.org/2000/01/rdf-schema#subClassOf") ) {
					$.each( element["http://www.w3.org/2000/01/rdf-schema#subClassOf"], function(key, subClass) {
						tmpLinks.push( { "source": element["@id"], "target": subClass["@id"], "subClassOf": true } );
					});
				}

				_this.classProperties[element["@id"]] = [];
				nodeIndexes[element["@id"]] = _this.graphModel.nodes.length;
				_this.graphModel.nodes.push( element );
				break;

			// add a property
			case "http://www.w3.org/1999/02/22-rdf-syntax-ns#Property":
			case "http://www.w3.org/2002/07/owl#DatatypeProperty":
			case "http://www.w3.org/2002/07/owl#FunctionalProperty":
				if ( ! element.hasOwnProperty("http://www.w3.org/2000/01/rdf-schema#domain") ) {
					console.log("No domain in property: ", element);
					_this.addStatusMsg( "<b>No @domain in property:</b> " + JSON.stringify(element) + "<br /><b>It cannot added to the graph.</b>", "warning");
					break;
				}					
				element["@d3"].type = "Property";
				
				// walk domain classes of the property
				$.each( element["http://www.w3.org/2000/01/rdf-schema#domain"], function(key, domain) {
					var thisElement = $.extend( true, {}, element );
					var thisKey = domain["@id"]+":"+thisElement["@id"];

					thisElement["@d3"].domain = domain["@id"];

					// maybe merge existing position
					if ( _this.graphLayout.hasOwnProperty(thisKey) ) {
						thisElement.x = _this.graphLayout[ thisKey ].x;
						thisElement.y = _this.graphLayout[ thisKey ].y;
					}

					/*
					if ( _this.classProperties.hasOwnProperty( domain["@id"] ) ) {
						// add as node and link to its class					
						_this.classProperties[domain["@id"]].push( thisElement );
						tmpLinks.push( { "source": thisKey, "target": domain["@id"], "isProperty" : true } );
						nodeIndexes[thisKey] = _this.graphModel.nodes.length;
						_this.graphModel.nodes.push( thisElement );
					} else {
						_this.addStatusMsg("<b>Domain-Class \""+domain["@id"]+"\" not found for Element:</b> " + JSON.stringify(thisElement) + "<br /><b>It cannot added to the graph!</b>", "warning");
					}
					*/
					
					// domain-class not found -> add extern class
					if ( ! _this.classProperties.hasOwnProperty( domain["@id"] ) ) {
						var externClass = { 
							"@id" : domain["@id"],
							"@d3" : {
								"type" : "Class",
								"label" : basename( domain["@id"] )
							}
						};
						// maybe merge existing position
						if ( _this.graphLayout.hasOwnProperty(domain["@id"]) ) {
							externClass.x = _this.graphLayout[ domain["@id"] ].x;
							externClass.y = _this.graphLayout[ domain["@id"] ].y;
						}
						_this.classProperties[domain["@id"]] = [];
						nodeIndexes[domain["@id"]] = _this.graphModel.nodes.length;
						_this.graphModel.nodes.push( externClass );

					}				
					
					// add link
					tmpLinks.push( { "source": thisKey, "target": domain["@id"], "isProperty" : true } );
					// add node
					_this.classProperties[domain["@id"]].push( thisElement );
					nodeIndexes[thisKey] = _this.graphModel.nodes.length;
					_this.graphModel.nodes.push( thisElement );									
				});
				break;

			// add a class relation
			case "http://www.w3.org/2002/07/owl#ObjectProperty":
				if ( ! element.hasOwnProperty("http://www.w3.org/2000/01/rdf-schema#domain")
					|| ! element.hasOwnProperty("http://www.w3.org/2000/01/rdf-schema#range") ) {
					console.log("No range or domain in relation: ", element);
					_this.addStatusMsg( "<b>No @range or @domain in relation:</b> " + JSON.stringify(element) + "<br /><b>It cannot added to the graph.</b>" , "warning");
					break;
				}					
				element["@d3"].type = "ClassRelation";

				$.each( element["http://www.w3.org/2000/01/rdf-schema#domain"], function(key, domain) {	
					$.each( element["http://www.w3.org/2000/01/rdf-schema#range"], function(key, range) {
						var thisElement = $.extend( true, {}, element );
						var thisKey = domain["@id"]+":"+thisElement["@id"]+":"+range["@id"];

						thisElement["@d3"].domain = domain["@id"];
						thisElement["@d3"].range = range["@id"];
													
						// range class not found -> create a extern pseudo class
						if ( ! nodeIndexes.hasOwnProperty(range["@id"]) ) {
							var externClass = { 
								"@id" : range["@id"],
								"@d3" : {
									"type" : "Class",
									"label" : basename( range["@id"] )
								}
							};
							// maybe merge existing position
							if ( _this.graphLayout.hasOwnProperty(range["@id"]) ) {
								externClass.x = _this.graphLayout[ range["@id"] ].x;
								externClass.y = _this.graphLayout[ range["@id"] ].y;
							}
							nodeIndexes[range["@id"]] = _this.graphModel.nodes.length;
							_this.graphModel.nodes.push( externClass );
						}						

						// maybe merge existing position
						if ( _this.graphLayout.hasOwnProperty(thisKey) ) {
							thisElement.x = _this.graphLayout[ thisKey ].x;
							thisElement.y = _this.graphLayout[ thisKey ].y;
						}

						// add links to its domain and range class
						tmpLinks.push( { "source": domain["@id"], "target": thisKey, } );
						tmpLinks.push( { "source": thisKey, "target": range["@id"], } );

						// add node
						nodeIndexes[thisKey] = _this.graphModel.nodes.length;
						_this.graphModel.nodes.push( thisElement );
					});
				});
				break;

			default:
				console.log("Unknown @type in: ", element);
				_this.addStatusMsg( "Unknown @type in: " + JSON.stringify(element) , "warning");
				break;
		}
	});

	$.each( tmpLinks, function(key, element) {
		var link = element;
		link["source"] = nodeIndexes[element.source];
		link["target"] = nodeIndexes[element.target];

		_this.graphModel.links.push( link );

	});		

	console.log( "Graph:  ", _this.graphModel );
	

	function basename (str) {
		return str.split(/[\\/]/).pop();
	}
} // end of createModel


// print the model as JointJS graph
RDFGraphVis.prototype.print = function(){
	var _this = this;

	// node drag by funktion
	// http://bl.ocks.org/norrs/2883411	
	var node_drag = d3.behavior.drag()
	    .on("dragstart", dragstart)
	    .on("drag", dragmove)
	    .on("dragend", dragend);	

	// add links
	var link = _this.svgGraph.selectAll(".link")
		.data(_this.graphModel.links)
		.enter().append("line")
		.attr("class", function(d) {
			var c = "link";
			if ( d.hasOwnProperty("isProperty") ) { c += " property-link" }
			if ( d.hasOwnProperty("subClassOf") ) { c += " subclass-link" }
			if ( d.hasOwnProperty("isClassRelation") ) { c += " class-relation" }
			return c;
		})
		.attr("marker-end", function(d) { 
			if ( d.hasOwnProperty("subClassOf") ) { 
				return "url(#endArrow)";
			}
		}); 
		
	// add nodes
	var node = _this.svgGraph.selectAll(".node")
		.data(_this.graphModel.nodes)
		.enter().append("svg:g")
		.attr("class", function(d) {
			var c = "node";
			if ( d["@d3"].type == "Class" ) { c += " class-node" }
			if ( d["@d3"].type == "ClassRelation" ) { c += " class-relation-node" }
			if ( d["@d3"].type == "Property" ) { c += " property-node" }
			return c;
		})
		.on("mouseover", function() {
			d3.select(this).classed("hover", true);
			d3.select('body').style("cursor", "pointer");
		})
		.on("mouseout", function() {
			d3.select(this).classed("hover", false);
			d3.select('body').style("cursor", "auto");
		})
		.on("mousedown", function() {
			d3.select('body').style("cursor", "move");
		})
		.on("click", function(d) {
			d3.selectAll(".node").classed("selected", false);
			d3.select(this).classed("selected", true);
			showNodeAttributes(d);
		})		
		.call(node_drag);		

	// add classes
	node.filter(function(d){
			if ( d["@d3"].type == "Class" ) { return true; }
		}).append("svg:rect")
		.attr("class", "class")
		.attr("x", "-30px")
		.attr("y", "-12px")
		.attr("width", "60px")
		.attr("height", "24px") 		
		.attr("rx", "5").attr("ry", "5");

	// add classe relations
	node.filter(function(d){
		if ( d["@d3"].type == "ClassRelation" ) {
			return true;
		}
		}).append("svg:polygon")
		.attr("class", "class-relation")
		.attr("points", "-30,0 0,20 30,0 0,-20");

	// add properties
	node.filter(function(d){
		if ( d["@d3"].type == "Property" ) {
			return true;
		}
		}).append("svg:ellipse")
		.attr("class", "property")
		.attr("rx", 24)
		.attr("ry", 12)
		.attr("cx", 0)
		.attr("cy", 0);

	// add labels
	node.append("svg:text")
		.attr("text-anchor", "middle") 
		.attr("class", "label")
		.attr("dy", "3px")
		//.attr("dx", "-25px")
		.attr("fill","black")
		.style("pointer-events", "none")
		.attr("font-size", "10px" )
		.attr("font-weight", "100" )
		//.attr("font-weight", function(d) { if (d.color == '#b94431') { return "bold"; } else { return "100"; } } )
		//.text( function(d) { if (d.color == '#b94431') { return d.id + ' (' + d.size + ')';} else { return d.id;} } ) ;
		.text( function(d) { return d["@d3"].label } ) ;

	// id as title
	node.append("title")
		.text(function(d) { return d["@id"] } );

	var minX = 0;
	var maxX = 0;
	var minY = 0;
	var maxY = 0;

	// set nodes fixed position if they already have x and y
	_this.svgGraph.selectAll("g.node").filter(function(d){		
		if ( d.x > maxX ) maxX = d.x;
		if ( d.x < minX ) minX = d.x;
		if ( d.y > maxY ) maxY = d.y;
		if ( d.y < minY ) minY = d.y;
		if ( d.hasOwnProperty("x") && d.hasOwnProperty("y") ) {
			d.fixed = true;
			return true;
		}
	});

	/*
	// TODO: initial zoom/translation
	if ( Object.keys(_this.graphLayout).length > 0 ) {
		var translX = (parseInt(_this.svg.attr("width")) - ( maxX - minX )) / 2;
		var translY = (parseInt(_this.svg.attr("height")) - ( maxY - minY )) / 2;
		//console.log( d3.event.translate );		
		d3.event = { "type" : "zoom", "scale" : 1, "translate": [translX, translY] };
		//d3.select(".this-graph")
		//	.attr("transform", "translate("+translX+","+translY+") scale(1)"); 
		
		//set the min and max extent to which zooming can occur and define a mouse zoom function
		//var zoom = d3.behavior.zoom().scaleExtent([0.3, 3]).on("zoom", _this.zoomed);
		//zoom.translate([500,50]).scale(2);//translate and scale to whatever value you wish
		//zoom.event(_this.svgGraph.transition().duration(50));//does a zoom
		_this.zoomed();
	}
	*/
	

	// auto width class and property-boxes
	arr1 = d3.selectAll("text.label");
	arr = arr1[0];
	for(var i=0; i<arr.length; i++){
		x = arr[i].previousSibling;
		var boxWidth = arr[i].getBBox().width;
		d3.select(x).filter(function(d){
				if ( d["@d3"].type == "Class" ) {
					d.width = boxWidth+10; // add this to node to fix the arrow positions
					return true;
				}
			})
			.attr("width", boxWidth+10 + "px")
			.attr("x",  -((boxWidth+10)/2) + "px");

		
		d3.select(x).filter(function(d){
				if ( d["@d3"].type == "ClassRelation" ) {
					return true;
				}
			})
			.attr("points", "-"+(boxWidth/1.5)+",0 0,20 "+(boxWidth/1.5)+",0 0,-20");

		if ( boxWidth < 60 ) {
			boxWidth = 60;
		}
		d3.select(x).filter(function(d){
				if ( d["@d3"].type == "Property" ) {
					return true;
				}
			})
			.attr("rx", boxWidth-30);
	}

	// force layout
	_this.force
		.nodes(_this.graphModel.nodes)
		.links(_this.graphModel.links)
		.on("tick", tick)
		.start();

	// drag functions
	function dragstart(d, i) {
		d3.event.sourceEvent.stopPropagation();
		_this.zoom = false;
	    _this.force.stop(); // stops the force auto positioning before you start dragging
	}

	function dragmove(d, i) {
	    d.px += d3.event.dx;
	    d.py += d3.event.dy;
	    d.x += d3.event.dx;
	    d.y += d3.event.dy; 
	    tick(); // this is the key to make it work together with updating both px,py,x,y on d !

	    if ( d["@d3"].type == "Class" && _this.classProperties.hasOwnProperty(d["@id"]) ) {
	    	// move the properties of this class
	    	$.each( _this.classProperties[d["@id"]], function() {
	    		this.px += d3.event.dx;
	    		this.py += d3.event.dy;
			    this.x += d3.event.dx;
			    this.y += d3.event.dy; 
	    	});
	    }

	    d3.select('body').style("cursor", "move");
	}

	function dragend(d, i) {
		_this.zoom = true;
	}
	// TODO ticks too often on start ?!
	// the t(r)ick - set node and link positions on start and drag
	function tick() {
		
	    link.attr("x1", function(d) { return d.source.x; })
	        .attr("y1", function(d) { return d.source.y; })
	        .attr("x2", function(d) { return d.target.x; })
	        .attr("y2", function(d) { return d.target.y; });
		
		// fix the subClass-link arrow positions, set it to the border of our target
		link.each(function(d) {
			if ( d.hasOwnProperty("subClassOf") ) {
				var x2 = 0;
				var y2 = 0;
				var targetH = ( d.target.y > d.source.y ) ? -13 : 13; // 13 => target box height			
				var m = ( d.target.y - d.source.y ) / ( d.target.x - d.source.x );
				var n = d.source.y - ( m * d.source.x );
				x2 = ( d.target.y + targetH - n ) / m ;	
				y2 = d.target.y + targetH;

				// test if the link is on the sides				
				if ( x2 < d.target.x - ( d.target.width / 2 ) || x2 > d.target.x + ( d.target.width / 2 ) ) {			
					x2 = ( d.target.x > d.source.x ) ? d.target.x - (d.target.width / 2) : d.target.x + (d.target.width / 2);
					y2 = m * x2 + n;
				}
				$(this).attr("x2", x2);
				$(this).attr("y2", y2);
			}
		});

	    node.attr("transform", function(d) { return "translate(" + d.x + "," + d.y + ")"; });    
	}
	function showNodeAttributes(d) {
		var msg = {};
		if ( d.hasOwnProperty("@id") ) {
			msg["@id"] = d["@id"];
			_this.scrollEditorTo("<" + d["@id"] + "> a");
		}
		if ( d.hasOwnProperty("@type") ) {
			msg["@type"] = d["@type"];
		}
		if ( d.hasOwnProperty("http://www.w3.org/2000/01/rdf-schema#label") ) {
			//msg["rdfs:label"] = JSON.stringify(d["http://www.w3.org/2000/01/rdf-schema#label"])			
			msg["rdfs:label"] = d["http://www.w3.org/2000/01/rdf-schema#label"][0]["@value"];
		}	
		if ( d.hasOwnProperty("http://www.w3.org/2000/01/rdf-schema#comment") ) {
			//msg["rdfs:comment"] = JSON.stringify(d["http://www.w3.org/2000/01/rdf-schema#comment"]);
			msg["rdfs:comment"] = d["http://www.w3.org/2000/01/rdf-schema#comment"][0]["@value"];
		}		
		_this.setStatusMsg(msg);	
	}
} // end of print

// return the layout for the graph
RDFGraphVis.prototype.createGraphLayout = function() {
	var _this = this;
	var graphLayout = new Object();
	$.each( _this.graphModel.nodes, function(key, element) {
		var thisKey = element["@id"];

		if ( element["@d3"].hasOwnProperty("domain") ) {
			thisKey = element["@d3"].domain + ":" + thisKey;
		}
		if ( element["@d3"].hasOwnProperty("range") ) {
			thisKey = thisKey + ":" + element["@d3"].range;
		}
		graphLayout[thisKey] = { "x" : element.x, "y": element.y };
	});
	//graphLayout = JSON.stringify( graphLayout );
	return graphLayout;
}

// update the graph
RDFGraphVis.prototype.update = function() {
	var _this = this;
	_this.setStatusMsg("Updating the graph...", "info");

	// from turtle to triples to json-ld
	var parser = N3.Parser();
	var triples = "";

	parser.parse( $( "#editor" ).val() ,
		function (error, triple, prefixes) {
			if (error) {
				_this.setStatusMsg("<b>N3 Parse-Error:</b> " + error, "error");
				return false;
			}
			if (triple) {
		 		triple.object = triple.object.replace(/\n/g, "\\n");
		 		triple.object = triple.object.replace(/\r/g, "\\r");
		 		triple.object = triple.object.replace(/\t/g, "\\t");
		 		triple.object = triple.object.replace(/\f/g, "\\f");
		 		triple.object = triple.object.replace(/^(http:\/\/\S*)/g, "<$1>");
		 		triple.object = triple.object.replace(/\^\^(http:\/\/\S*)/g, "^^<$1>");

		 		triples += "<" + triple.subject + "> <" + triple.predicate + "> " + triple.object + " .\n";
		 		
			} else {
		 		
		 		jsonld.fromRDF(triples, {format: 'application/nquads'}, function(err, doc) {
		 			if ( err ) {
		 				_this.setStatusMsg("JSON-LD fromRDF-Error: " + err, "error");
		 				return false;
		 			}

		 			_this.setStatusMsg("");
		 			// set model
					_this.model = doc;

					// create new layout
					_this.graphLayout =_this.createGraphLayout();

					// reset model
					_this.graphModel.nodes = [];
					_this.graphModel.links = [];
					// remove nodes and links
					_this.svg.selectAll("g.node").remove();
					_this.svg.selectAll("line").remove();
					
					_this.createModel();
					_this.print();
				});
			}
		}
	);

}


// save the graph
RDFGraphVis.prototype.save = function() {
	var _this = this;
	//var graphLayout = new Object();
	var graphId = _this.id;
	_this.setStatusMsg("");
	
	if ( graphId == "" ) {
		alert( "Error: Empty Graph-ID!" );
		return false;
	}

	// get graph layout 
	var graphLayout = JSON.stringify( _this.createGraphLayout() );


	// get vocabulary from frontend-editor
	var parser = N3.Parser();
	var voc = "";

	if ( _this.base != null ) {
		voc += "@base <" + _this.base + "> .\n";
	}

	$.each( _this.prefixes, function(prefix, puri) {
		voc += "@prefix " + prefix + ": <" + puri + "> .\n";
	});

	parser.parse( $( "#editor" ).val() ,
		function (error, triple, prefixes) {
			if (triple) {
		 		//console.log("Triple:", triple.subject, triple.predicate, triple.object, '.');
		 		triple.object = triple.object.replace(/\n/g, "\\n");
		 		triple.object = triple.object.replace(/\r/g, "\\r");
		 		triple.object = triple.object.replace(/\t/g, "\\t");
		 		triple.object = triple.object.replace(/\f/g, "\\f");
		 		triple.object = triple.object.replace(/^(http:\/\/\S*)/g, "<$1>");
		 		triple.object = triple.object.replace(/\^\^(http:\/\/\S*)/g, "^^<$1>");
		 		//console.log("Object: " + triple.object);

		 		voc += "<" + triple.subject + "> <" + triple.predicate + "> " + triple.object + " .\n";
		 		
			} else {
				// save voc and graph-layout
				$.post( "ajax/save.php", { name: graphId, voc: voc, layout: graphLayout })
					.fail(function(e) {
						console.log("Error", e);
						_this.addStatusMsg("Error: cannot save graph");
					})
					.done(function( jsondata ) {
						if ( jsondata.result == true ) {
							_this.addStatusMsg(jsondata.msg);
							_this.interface.fillHistory();
						} else {
							console.log(jsondata.msg);
							_this.addStatusMsg(jsondata.msg);
						}
				});
			}
		});
}

/*
Set interface functions (navi, sidebar, history, voc-selector...)
*/
RDFGraphVis.prototype.interface = function(){
	var _this = this;

	// set title
	$(".navbar-brand").html("VocTo - " + _this.id );
	document.title = "VocTo - " + _this.id ;

	// file editor with turtle
	hideSidebar = function() { 
		$( ".sidebar" ).css("width", "0" );
		$( ".footer" ).css("marginLeft", "0" );
	 };
    _this.updateEditor(
    	hideSidebar
    );

    // drag sidebar
    dragSidebar = null;
    mouseX = 0;
    $(".sidebar-dragzone").on("mousedown", function(e) {
    	dragSidebar = window.setInterval(function() {
	        dragSidebarFct();
	    }, 100);
    });
    $("body").mousemove(function(e){
    	mouseX = e.pageX;
    });
		
	$("body, .sidebar-dragzone").on("mouseup, click", function() {		
		window.clearInterval(dragSidebar);
	    dragSidebar = null;
	} );

	function dragSidebarFct() {
		if ( dragSidebar != null ) {
			$( ".sidebar" ).css("width", mouseX + "px" );
			$( "footer" ).css( "marginLeft", mouseX + "px" );	
		}		
	}

	// toggle sidebar	
	$(".toggle-sidebar").click(function() {
		if ( $(".sidebar").width() > 100 ) {
			$( ".sidebar" ).animate({ width: "0" });
			$( ".footer" ).animate({ marginLeft: "0" });
		} else {			
			$( ".sidebar" ).animate({ width: "40%" });			
			$( ".footer" ).animate({ marginLeft: "40%" });
		}
    });

	// update graph after keypress in editor
	autoUpdateInterval = null;
	$( "#editor" ).keypress(function() {
	    window.clearTimeout(autoUpdateInterval);
	    autoUpdateInterval = window.setTimeout(function() {
	        _this.update();
	    }, 1500);
	})

    // toggle history
    $(".toggle-history").click(function() {
    	$("#voc").hide();
        $("#history").toggle();
    });    

    // fill history
    _this.interface.fillHistory = function() {
    	var $list = $(".history-list");
    	$list.html('');
	    $.post( "ajax/get.php", { name: "log-" + _this.id + ".txt" })  
			.done(function( jsondata ) {
				
			    if ( ! jsondata.result || jsondata.content == "" ) {
			    	$list.append('No older versions found');
			        return false;
			    }
			    
			    var lines = jsondata.content.split("\n");;		    
			    $.each(lines, function(lineIndex, line){
			        if (line == "") {
			            return true;
			        }
			        var vals = line.split(" ");
			        var date = new Date(parseInt(vals[0])*1000);
			        $list.append('<a href="#" class="list-group-item" data-time="'+vals[0]+'">'+date.getFullYear()+'-'+(date.getMonth()+1)+'-'+date.getDate()+', '+date.getHours()+'h '+date.getMinutes()+':'+date.getSeconds()+'s</a>');
			    });

			    $(".history-list a").click(function() {
			        var time = $(this).attr("data-time");
			        $("#history").hide();
			        _this.setStatusMsg("");

			        $.post( "ajax/get.php", { name: _this.id + "-" + time + ".n3" })      
			            .done(function( jsondata ) {
			                if ( jsondata.result && jsondata.content != "" ) {
			                    // reset model
								_this.graphModel.nodes = [];
								_this.graphModel.links = [];
								// remove nodes and links
								_this.svg.selectAll("g.node").remove();
								_this.svg.selectAll("line").remove();

			                    _this.nquads = jsondata.content;
			                    _this.layoutFile = _this.id + "-" + time + ".json";
			                    _this.updateEditor();
			                    _this.parse();
			                }
			        });
			    });
		});
    };
    _this.interface.fillHistory();
    

	// toggle voc selector
    $(".select-voc").click(function() {
    	$("#history").hide();
        $("#voc").toggle();
    });

	// fill voc selection
	$.post( "ajax/getAll.php" )
		.done(function( jsondata ) {
			var $list = $(".voc-list");
			
		    //var lines = jsondata.content.split("\n");;
		    $.each(jsondata.result, function(i, voc){
		        if (voc == "") {
		            return true;
		        }
		        $list.append('<a href="#" class="list-group-item" data-voc="'+voc+'">'+voc+'</a>');
		    });

		    // select a vocabulary. Remove prev graph and actions and create a new
		    $(".voc-list a").click(function() {
				var voc = $(this).attr("data-voc");
				$("#voc").toggle();
				$("#graph").html('');
				$(".history-list").html('');
				$(".voc-list").html('');
				$("*").off("click");
				_this.setStatusMsg("");

				$.post( "ajax/get.php", { name: voc + ".n3" })      
					.done(function( jsondata ) {
						if ( jsondata.result && jsondata.content != "" ) {
							rdfgraphvis = new RDFGraphVis({
								data: jsondata.content,
								id : voc,
								prefixes: jsondata.prefixes,
								base: jsondata.base,
							});
						} else {
							console.log("Error", jsondata.msg);
						}
					})
					.fail(function(e) {
						console.log("Error", e);
				});

		    });
	});

	// reset positions
	$(".reset-position").click( function() {
		// reset values
		_this.layoutFile = "";
		_this.model = []; // store json-ls model
		_this.graphModel = { "nodes" : [], "links" : [] }; // store nodes and links
		_this.graphLayout = {}; // stored model-layout with xy-positions
		_this.classProperties = {};

		// remove nodes and links
		_this.svg.selectAll("g.node").remove();
		_this.svg.selectAll("line").remove();

		_this.parse();
	});

	// toggle properties
	var hide = true;
	$(".toggle-properties").click( function() {
		var display = hide ? "none" : "inline";
		_this.svgGraph.selectAll(".property-node")
			.style("display", display);

		_this.svgGraph.selectAll(".property-link")
			.style("display", display);

	    hide = ! hide;
	});

	$(".zoom-in").click( function() {
	});
	$(".zoom-out").click( function() {
	});


	function testNewVoc() {
		var id = prompt("Unique ID (Title):");
		var uri = prompt("Baseuri:");

		$.post( "ajax/get.php", { name: id +".n3" })
			.done(function( jsondata ) {
				if ( jsondata.result == false ) {
					_this.newVocabulary(id, uri);
				} else {
					alert("This name already exists. Please choose another ID.");
					testNewVoc();
				}
			}
		);
	}

	// create a new empty vocabulary
	$(".new-voc").click( function() {
		testNewVoc();
	});

	// save file
	$(".save-graph").click( function() {
		_this.save();
	});

	// toggle editor syntax highlighting
	/*
	$(".toggle-editorSyntax").click(function() {
		$(".CodeMirror").toggle();
		$("#editor").toggle();
	});
	*/
}

RDFGraphVis.prototype.newVocabulary = function(newId, newUri) {
	var _this = this;

	// may append slash to uri
	if ( newUri.substr(-1) != "/" ) {
		newUri += "/";
	}

	$("#graph").html('');
	$(".history-list").html('');
	$(".voc-list").html('');
	$("*").off("click");

	new RDFGraphVis({
		data: '<'+newUri+'Person> <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <http://www.w3.org/2002/07/owl#Class> . \n' +
			'<'+newUri+'Person> <http://www.w3.org/2000/01/rdf-schema#label> "A person" . \n' +
			'<'+newUri+'title> <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <http://www.w3.org/2002/07/owl#DatatypeProperty> . \n' +
			'<'+newUri+'title> <http://www.w3.org/2000/01/rdf-schema#domain> <'+newUri+'Person> . \n' +
			'<'+newUri+'knows> <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <http://www.w3.org/2002/07/owl#ObjectProperty> . \n' +
			'<'+newUri+'knows> <http://www.w3.org/2000/01/rdf-schema#domain> <'+newUri+'Person> . \n' +
			'<'+newUri+'knows> <http://www.w3.org/2000/01/rdf-schema#range> <'+newUri+'Person> . \n'
			,
		id : newId,
		prefixes: {
			"rdf" : "http://www.w3.org/1999/02/22-rdf-syntax-ns#",
			"owl" : "http://www.w3.org/2002/07/owl#",
			"rdfs" : "http://www.w3.org/2000/01/rdf-schema#"
		},
		base: newUri,
	});
}

// fill editor with turtle
RDFGraphVis.prototype.updateEditor = function(onFilled) {
	var _this = this;
	// parse n3 to turtle for textarea editor
	var triples = _this.nquads.split("\n");
    var prefixes = _this.prefixes;
    
    var writer = N3.Writer( prefixes );
	$.each( triples, function( key, value) {
		var parser = new N3.Parser();
	    parser.parse(value, function (error, triple, prefixes ) {
	    	if (triple) {
                 writer.addTriple( triple.subject, triple.predicate, triple.object );
			}
			if ( key+1 == triples.length  ) {
	            writer.end(function (error, result) { 
	            	result = result.replace(/\.\n/g, " .\n\n");
	            	result = result.replace(/;\n/g, " ;\n");
	            	result = result.replace(/\n@/g, "@");

	            	if ( _this.base ) {
	            		var regex = new RegExp( "<"+_this.base+"(\\S*)>", "g" );
	            		result = result.replace(regex, "<$1>");
	            		result = "@base <"+_this.base+"> .\n" + result;
	            	}

			        $("#editor").val( result );

					// add tynax highlighting editor CodeMirror
					$(".CodeMirror").remove(); // may remove old codeMirror fields
					var editor = CodeMirror.fromTextArea(document.getElementById("editor"), {
						mode: "text/turtle",
						matchBrackets: true,
						//autofocus: true,
						//lineWrapping: true,
						lineNumbers: true
					});
					if ( typeof onFilled !== undefined ) {
						onFilled();
					}
					
					editor.on('change',function(cMirror){
						// get value right from instance
						$("#editor").val(cMirror.getValue());
						$("#editor").trigger("keypress");
					});

					$("#editor").height( window.innerHeight - $(".navbar").height() );
					$(".CodeMirror").height( window.innerHeight - $(".navbar").height() );
			    });
	        }
	    });
	});
}

// scroll to specific word in texteditor
// credits to: http://blog.blupixelit.eu/scroll-textarea-to-selected-word-using-javascript-jquery/
RDFGraphVis.prototype.scrollEditorTo = function(str) {
	var _this = this;
	var $editor = $('#editor');
	if ( ( ! $('.CodeMirror').is(':visible') && ! $editor.is(':visible') ) || typeof str === undefined || str == "" ) {
		return false;
	}

	if ( _this.base ) {
		var regex = new RegExp( "<"+_this.base+"(.*)>", "g" );
		str = str.replace(regex, "<$1>");
	}

	// scroll to syntax hihglighted editor line
	if ( $('.CodeMirror').is(':visible') ) {

		// clear old marker
		var editor = $('.CodeMirror')[0].CodeMirror;
		$.each(_this.state.editorMarks, function(key, mark){
			mark.clear();
		});
		_this.state.editorMarks = [];

		// set new marker
		var cursor = editor.getSearchCursor(str);
		while( cursor.findNext() ) {
			var mark = editor.markText( cursor.from(), cursor.to(), {
				className: "cm-searching"
			});
			_this.state.editorMarks.push(mark);
			editor.scrollIntoView( cursor.from() );
		}

	}
	// scroll to syntax snmple texteditor line
	if ( $editor.is(':visible') ) {
		var posi = $editor.val().indexOf(str); // take the position of the word in the text
		if (posi != -1) {
			// select the textarea and the word
			$editor.get(0).focus();
		    if ($editor.get(0).setSelectionRange)
		        $editor.get(0).setSelectionRange(posi, posi+str.length);
		    else {
		        var r = $editor.get(0).createTextRange();
		        r.collapse(true);
		        r.moveEnd('character',  posi+str);
		        r.moveStart('character', posi);
		        r.select();
		    }
		    
		    // scroll to word
			var sh = $editor.get(0).scrollHeight; //height in pixel of the textarea (n_rows*line_height)
			var line_ht = $editor.css('line-height').replace('px',''); //height in pixel of each row
			var n_lines = sh/line_ht; // the total amount of lines
			var char_in_line = $editor.val().length / n_lines; // amount of chars for each line
			var height = Math.floor(posi/char_in_line); // amount of lines in the textarea
			$editor.scrollTop(height*line_ht); // scroll to the selected line
		}
	}
}


RDFGraphVis.prototype.addStatusMsg = function(msg) {
	$(".status-bar").show();
	$(".status-bar").html( $(".status-bar").html() + "<br />" + msg );
}

/*
Set the status message
@msg String The wessages
@type String info|warning|error
*/
RDFGraphVis.prototype.setStatusMsg = function(msg, type) {
	if ( typeof type === undefined ) {
		type = "info";
	}
	// TODO: alert errors and warnings
	$(".status-bar").show();
	if( typeof msg === "string" ) {
		$(".status-bar").text(msg);
	} else {
		/*
		var txt = "<table class='table table-condensed'>";
		$.each(msg,function(key, value) {
			txt += "<tr><td>"+key+"&nbsp;</td><td>"+value+"</td></tr>";
		})
		txt += "</table>";
		*/
		var txt = "| ";
		$.each(msg,function(key, value) {
			txt += "<strong>"+key+": </strong>"+value+" | ";
		})
		$(".status-bar").html(txt);
	}
}
