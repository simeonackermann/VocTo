// the RDFGraphvis class
RDFGraphVis = function( settings ) {
	this.nquads = settings.data;
	this.id = settings.id;
	/*if ( settings.id ) {
		this.id = settings.id;
	}*/

	this.state = {

	};

	//this.thisGraph = null;
	this.svg = null;
	this.svgGraph = null;
	//this.svgLinks = null;
	//this.svgNodes = null;

	this.model = []; // store json-ls model
	this.graphModel = { "nodes" : [], "links" : [] }; // store nodes and links
	this.storedModel = {}; // stored model with positions
	this.classProperties = {};

	//this.vis = null;
	this.force = null;
	this.zoom = true;
	
	this.init();
	return this;
}

// init the graph, element and links
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
	/*
	// append content rect
	_this.vis.append('svg:rect')
		.attr('width', w)
		.attr('height', h)
		.attr('fill', 'rgba(1,1,1,0)');
	*/

	//console.log( parseInt(_this.svg.attr("width")) );
	//return false;

	// define the arrow.
	var defs = _this.svg.append("svg:defs").selectAll("marker")
		.data(["end"])      // Different link/path types can be defined here
		.enter().append("svg:marker")    // This section adds in the arrows
		.attr("id", String)
		.attr("viewBox", "0 -5 10 10")
		.attr("refX", 18)
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

	/*
	function redraw() {
		if ( _this.zoom )
			_this.vis.attr("transform","translate(" + d3.event.translate + ")" + " scale(" + d3.event.scale + ")");
	}
	*/

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
    d3.select(window).on("keydown", function(){
      _this.svgKeyDown.call(_this);
    })
    .on("keyup", function(){
      _this.svgKeyUp.call(_this);
    });
    _this.svg.on("mousedown", function(d){_this.svgMouseDown.call(_this, d);});
    _this.svg.on("mouseup", function(d){_this.svgMouseUp.call(_this, d);});          

	// listen for dragging
    var dragSvg = d3.behavior.zoom()
          .on("zoom", function(){
            if (d3.event.sourceEvent.shiftKey){
              // TODO  the internal d3 state is still changing
              return false;
            } else{
              _this.zoomed.call(_this);
            }
            return true;
          })
          .on("zoomstart", function(){
            //if (!d3.event.sourceEvent.shiftKey) d3.select('body').style("cursor", "move");
          })
          .on("zoomend", function(){
            d3.select('body').style("cursor", "auto");
          });

    _this.svg.call(dragSvg).on("dblclick.zoom", null);        

	//return false;
	// listen for resize
    window.onresize = function(){_this.updateWindow();};

    //return false;
    //console.log("nquads", _this.nquads);
    var triples = _this.nquads.split("\n");
    //console.log("triples:", triples);
    var prefixes = {
    	'rdfs' : 'http://www.w3.org/2000/01/rdf-schema#'
    };
	var writer = N3.Writer( {
		//'cpm': 'http://catalogus-professorum.org/cpm/',
		'rdfs' : 'http://www.w3.org/2000/01/rdf-schema#',
		'owl': 'http://www.w3.org/2002/07/owl#'
	});
	//var parser = new N3.Parser();
	$.each( triples, function( key, value) {
		//console.log("vaue: " + value);
		var parser = new N3.Parser();
	    parser.parse(value, function (error, triple, prefixes) {

	    	//var predicate = this._predicate.replace(/\<http:\/\/www\.w3\.org\/2000\/01\/rdf-schema#label\>/g, "rdfs:label");
	    	//console.log(this._subject, this._predicate, this._object);
	    	//var predicate = this._predicate.replace(/http:\/\/www\.w3\.org\/2000\/01\/rdf-schema#label/g, "XXX");

	    	if (triple) {
                 //console.log("TRIPLES", triple.subject, triple.predicate, triple.object, '.');
                 writer.addTriple( triple.subject, triple.predicate, triple.object );
             }
	        /*
	        	else
                 console.log("# That's all, folks!", prefixes)
             */

	        //console.log(error);
	        
	        if ( key+1 == triples.length  ) {
	            writer.end(function (error, result) { 
	            	result = result.replace(/\.\n/g, ".\n\n");
	            	result = result.replace(/\n@/g, "@");
			        $("#ontologie-editor").val( result );
			        //console.log("result:", result);
			    });
	        }
	    });
	} );


	// parse nquads to json
	jsonld.fromRDF(_this.nquads, {format: 'application/nquads'}, function(err, doc) {		
		_this.model = doc;

		console.log( "Model:  ", _this.model );
		//$("#ontologie-editor").val( JSON.stringify(_this.model, null, ' ') );

		// try to get base from ontology		
		/*if ( _this.id == "" && _this.model[0]["@type"] == "http://www.w3.org/2002/07/owl#Ontology" ) {
			_this.id = _this.model[0]["@id"];
		}*/
			
		// maybe get stored graph
		$.post( "ajax/get.php", { name: encodeURIComponent( _this.id ) + ".json" })		
			.done(function( jsondata ) {
				if ( jsondata.result && jsondata.content != "" ) {
					_this.storedModel = $.parseJSON( jsondata.content );
					console.log( "Got saved graph model: " + _this.id + ".json" );
				} 
				_this.parse();
		});
	});

} // end of init

RDFGraphVis.prototype.zoomed = function(){
    //this.state.justScaleTransGraph = true;
    //console.log( d3.event );
    if ( this.zoom )
    	d3.select(".this-graph")
      		.attr("transform", "translate(" + d3.event.translate + ") scale(" + d3.event.scale + ")"); 
  };

 RDFGraphVis.prototype.updateWindow = function(){
 	var _this = this;
    var docEl = document.documentElement,
        bodyEl = document.getElementsByTagName('body')[0];
    var x = window.innerWidth || docEl.clientWidth || bodyEl.clientWidth;
    var y = window.innerHeight|| docEl.clientHeight|| bodyEl.clientHeight;
    _this.svg.attr("width", x).attr("height", y);
  };

// mousedown on main svg
  RDFGraphVis.prototype.svgMouseDown = function(){
    this.state.graphMouseDown = true;
  };  

 // mouseup on main svg
  RDFGraphVis.prototype.svgMouseUp = function(){
    this.state.graphMouseDown = false;
    $(".status-bar").text("");	
  };  

  RDFGraphVis.prototype.svgKeyDown = function(){
    
  };

  RDFGraphVis.prototype.svgKeyUp = function(){
    
  };  

// parse the rdf to json-ld
RDFGraphVis.prototype.parse = function(){
	var _this  = this;

	$("#graph-id").val(  _this.id );


	var nodeIndexes = new Object();
	var tmpLinks = new Array();	

	// walk model
	$.each( _this.model, function(classI, element) {
		element["@d3"] = new Object();

		if ( ! element.hasOwnProperty("@type") ) {
			console.log("No @type in: ", element);
			return false;
		}

		if ( ! element.hasOwnProperty("@id") ) {
			console.log("No @id in: ", element);
			return false;
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
			case "http://www.w3.org/2002/07/owl#Class":

				element["@d3"].type = "Class";

				// maybe merge existing position
				if ( _this.storedModel.hasOwnProperty(element["@id"]) ) {
					element.x = _this.storedModel[ element["@id"] ].x;
					element.y = _this.storedModel[ element["@id"] ].y;
				}

				// maybe add as subclass
				if ( element.hasOwnProperty("http://www.w3.org/2000/01/rdf-schema#subClassOf") ) {
					$.each( element["http://www.w3.org/2000/01/rdf-schema#subClassOf"], function(key, subClass) {
						tmpLinks.push( { "source": subClass["@id"], "target": element["@id"], "subClassOf": true } );
					});
				}

				_this.classProperties[element["@id"]] = [];
				nodeIndexes[element["@id"]] = _this.graphModel.nodes.length;
				_this.graphModel.nodes.push( element );
				break;

			// add a property
			case "http://www.w3.org/2002/07/owl#DatatypeProperty":
			case "http://www.w3.org/2002/07/owl#FunctionalProperty":
				if ( ! element.hasOwnProperty("http://www.w3.org/2000/01/rdf-schema#domain") ) {
					console.log("No domain in property: ", element);
					return false;
				}					
				element["@d3"].type = "Property";
				
				// walk domain classes of the property
				$.each( element["http://www.w3.org/2000/01/rdf-schema#domain"], function(key, domain) {
					var thisElement = $.extend( true, {}, element );
					var thisKey = domain["@id"]+":"+thisElement["@id"];

					thisElement["@d3"].domain = domain["@id"];

					// maybe merge existing position
					if ( _this.storedModel.hasOwnProperty(thisKey) ) {
						thisElement.x = _this.storedModel[ thisKey ].x;
						thisElement.y = _this.storedModel[ thisKey ].y;
					}

					// add as node and link to its class					
					_this.classProperties[domain["@id"]].push( thisElement );
					tmpLinks.push( { "source": thisKey, "target": domain["@id"], "isProperty" : true } );
					nodeIndexes[thisKey] = _this.graphModel.nodes.length;
					_this.graphModel.nodes.push( thisElement );
				});
				break;

			// add a class relation
			case "http://www.w3.org/2002/07/owl#ObjectProperty":
				if ( ! element.hasOwnProperty("http://www.w3.org/2000/01/rdf-schema#domain")
					|| ! element.hasOwnProperty("http://www.w3.org/2000/01/rdf-schema#range") ) {
					console.log("No range or domain in property: ", element);
					return false;
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
							if ( _this.storedModel.hasOwnProperty(range["@id"]) ) {
								externClass.x = _this.storedModel[ range["@id"] ].x;
								externClass.y = _this.storedModel[ range["@id"] ].y;
							}
							nodeIndexes[range["@id"]] = _this.graphModel.nodes.length;
							_this.graphModel.nodes.push( externClass );
						}						

						// maybe merge existing position
						if ( _this.storedModel.hasOwnProperty(thisKey) ) {
							thisElement.x = _this.storedModel[ thisKey ].x;
							thisElement.y = _this.storedModel[ thisKey ].y;
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
				break;
		}
	});
	//console.log( "tmpLinks:  ", tmpLinks );

	$.each( tmpLinks, function(key, element) {
		//console.log( nodeIndexes[element.source] );
		var link = element;
		link["source"] = nodeIndexes[element.source];
		link["target"] = nodeIndexes[element.target];

		_this.graphModel.links.push( link );

	});		

	//console.log( "nodeIndexes:  ", nodeIndexes );
	console.log( "Graph:  ", _this.graphModel );

	_this.print();

	function basename (str) {
		return str.split(/[\\/]/).pop();
	}
} // end of parsing


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
		.attr("marker-end", function(d) { if ( d.hasOwnProperty("subClassOf") ) { return "url(#end)" } } )
		.style("stroke-width", "2")
		.style("stroke", "gray");    
		
	// add nodes
	var node = _this.svgGraph.selectAll(".node")
		.data(_this.graphModel.nodes)
		.enter().append("svg:g")
		//.attr("class", "node")
		.attr("class", function(d) {
			var c = "node";
			if ( d["@d3"].type == "Class" ) { c += " class-node" }
			if ( d["@d3"].type == "ClassRelation" ) { c += " class-relation-node" }
			if ( d["@d3"].type == "Property" ) { c += " property-node" }
			return c;
		})		
		.on("click", function(d) {
			//console.log( d );
			//$(".status-bar").text( JSON.stringify( d ) );
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
		.attr("rx", "5").attr("ry", "5")		
		.style("fill", "#4987AC")
		.style("stroke", "#1D3C4F");
		/*.on("mouseover", function(d){
			d3.select(this).classed("class-hover", true);
      	})
      	.on("mouseout", function(d){
        	d3.select(this).classed("class-hover", false);
      	});*/

	// add classe relations
	node.filter(function(d){
		if ( d["@d3"].type == "ClassRelation" ) {
			return true;
		}
		}).append("svg:polygon")
		.attr("class", "class-relation")
		.attr("points", "-30,0 0,20 30,0 0,-20")
		.style("fill", "#70A897")
		.style("stroke", "#0E543F");	

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
		.attr("cy", 0)		
		.style("fill", "#FFF564")
		.style("stroke-width", "1")
		.style("stroke", "#E5C23D");

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
		}})

	/*
	// TODO: initial zoom/translation
	if ( Object.keys(_this.storedModel).length > 0 ) {
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
			//.attr("rx", boxWidth-30);
			.attr("points", "-"+(boxWidth/2)+",0 0,20 "+(boxWidth/2)+",0 0,-20");
		//.attr("points", "-30,0 0,20 30,0 0,-20")

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
		_this.zoom = false;
	    _this.force.stop() // stops the force auto positioning before you start dragging	    
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
	}

	function dragend(d, i) {
		_this.zoom = true;
	    //d.fixed = true; // of course set the node to fixed so the force doesn't include the node in its auto positioning stuff
	    //tick();
	    //force.resume();
	}
	function tick() {
	    link.attr("x1", function(d) { return d.source.x; })
	        .attr("y1", function(d) { return d.source.y; })
	        .attr("x2", function(d) { return d.target.x; })
	        .attr("y2", function(d) { return d.target.y; });
	    node.attr("transform", function(d) { return "translate(" + d.x + "," + d.y + ")"; });    
	}
	function showNodeAttributes(d) {
		//$(".status-bar").text( JSON.stringify( d ) );
		//console.log(d);
		if ( d.hasOwnProperty("@id") ) {
			_this.addStatusMsg( "@id: " + d["@id"] );
		}
		if ( d.hasOwnProperty("@type") ) {
			_this.addStatusMsg( "@type: " + d["@type"] );
		}
		if ( d.hasOwnProperty("http://www.w3.org/2000/01/rdf-schema#comment") ) {
			_this.addStatusMsg( "rdfs:comment: " + JSON.stringify(d["http://www.w3.org/2000/01/rdf-schema#comment"]) );
		}
		if ( d.hasOwnProperty("http://www.w3.org/2000/01/rdf-schema#label") ) {
			_this.addStatusMsg( "rdfs:label: " + JSON.stringify(d["http://www.w3.org/2000/01/rdf-schema#label"]) );
		}	
	}
}

// update the graph
RDFGraphVis.prototype.update = function() {
	var _this = this;

	_this.setStatusMsg("Updating Graph...");

	// from turtle to triples to json-ld
	var parser = N3.Parser();
	var triples = "";

	parser.parse( $( "#ontologie-editor" ).val() ,
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

		 		triples += "<" + triple.subject + "> <" + triple.predicate + "> " + triple.object + " .\n";
		 		
			} else {
		 		//console.log("# That's all, folks!", prefixes);		 		
		 		
		 		//triples = triples.replace(/(http:\/\/\S*)/g, "<$1>");
		 		//console.log("TRIPLES VOR REPLACE", triples);
		 		//triples = triples.replace(/(http:\/\/[a-zA-Z0-9_\-\.\/#]*)/g, "<$1>");
		 		
		 		//triples = triples.replace(/(http:\/\/\S*)/g, "<$1>");
		 		//triples = triples.replace(/"<(.*)">/g, "\"$1\"");
		 		
		 		//console.log("TRIPLES NACH REPLACE: " + triples);
		 		
		 		jsonld.fromRDF(triples, {format: 'application/nquads'}, function(err, doc) {		
		 			_this.setStatusMsg("");
					//_this.model = doc;
					//console.log("jsonld:" ,doc);
					_this.model = doc;
	
					_this.graphModel.nodes = [];
					_this.graphModel.links = [];

					_this.svg.selectAll("g.node").remove();
					_this.svg.selectAll("line").remove();
					
					_this.parse();					
				});
			}
		}
		/*,
		function( prefix, uri ) {
			console.log(prefix, uri);
		}*/
	);
	
//console.log(triples)

	/*

	_this.model = $.parseJSON( $( "#ontologie-editor" ).val() );
	
	_this.graphModel.nodes = [];
	_this.graphModel.links = [];

	_this.svg.selectAll("g.node").remove();
	_this.svg.selectAll("line").remove();
	
	_this.parse();

	*/
}

// save the graph
RDFGraphVis.prototype.save = function() {
	var _this = this;
	var content = new Object();
	//var graphId = $("#graph-id").val();
	var graphId = _this.id;
	_this.setStatusMsg("");
	if ( graphId == "" ) {
		alert( "Please give an unique ID for this Graph" );
		return false;
	}

	$.each( _this.graphModel.nodes, function(key, element) {
		var thisKey = element["@id"];

		if ( element["@d3"].hasOwnProperty("domain") ) {
			thisKey = element["@d3"].domain + ":" + thisKey;
		}
		if ( element["@d3"].hasOwnProperty("range") ) {
			thisKey = thisKey + ":" + element["@d3"].range;
		}
		content[thisKey] = { "x" : element.x, "y": element.y };
	});

	//console.log("Save, Graph: ", content);
	content = JSON.stringify( content );

	$.post( "ajax/save.php", { name: encodeURIComponent( graphId ) + ".json", content: content })
		.fail(function(e) {
			console.log("Error", e);
			_this.addStatusMsg("Error: cannot write " + graphId + ".json");
		})
		.done(function( jsondata ) {
			_this.addStatusMsg(jsondata.msg);
	});


	// save vocabulary
	var parser = N3.Parser();
	var triples = "";
	parser.parse( $( "#ontologie-editor" ).val() ,
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

		 		triples += "<" + triple.subject + "> <" + triple.predicate + "> " + triple.object + " .\n";
		 		
			} else {
				//console.log( "Save: ", triples );
				$.post( "ajax/save.php", { name: encodeURIComponent( graphId ) + ".n3", content: triples })
					.fail(function(e) {
						console.log("Error", e);
						_this.addStatusMsg("Error: cannot write " + graphId + ".n3");
					})
					.done(function( jsondata ) {
						_this.addStatusMsg(jsondata.msg);
				});
			}
		});
}

// sow or hide proprties
RDFGraphVis.prototype.toggleProperties = function(hide) {
	var _this = this;
	var display = hide ? "none" : "inline";
	_this.svgGraph.selectAll(".property-node")
		.style("display", display);

	_this.svgGraph.selectAll(".property-link")
		.style("display", display);
}

RDFGraphVis.prototype.addStatusMsg = function(msg) {
	$(".status-bar").html( $(".status-bar").html() + "<br />" + msg );
}

RDFGraphVis.prototype.setStatusMsg = function(msg) {	
	if( typeof msg === "string" ) {
		$(".status-bar").text(msg);
	} else {
		var txt = "";
		$.each(msg,function() {
			txt += this+"<br />";
		})
		$(".status-bar").text(txt);
	}
}