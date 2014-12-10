// the RDFGraphvis class
RDFGraphVis = function( settings ) {
	this.nquads = settings.data;
	this.base = "";
	if ( settings.id ) {
		this.base = settings.id;
	}
	this.model = new Array();
	this.storedModel = new Object();

	this.nodes = new Array();
	this.links = new Array();

	this.vis = null;
	this.force = null;
	
	this.init();
	return this;
}

// init the graph, element and links
RDFGraphVis.prototype.init = function() {
	var _this = this;

	// init graph
	var w = 1000;
	var h = 600;

	_this.vis = d3.select("#graph").append("svg:svg")
		.attr("width", w)
		.attr("height", h)
		.attr("pointer-events", "all")
		//.append('svg:g')
		//.call(d3.behavior.zoom().on("zoom", redraw))
		.append('svg:g');

	_this.vis.append('svg:rect')
		.attr('width', w)
		.attr('height', h)
		.call(d3.behavior.zoom().on("zoom", redraw))
		.attr('fill', 'rgba(1,1,1,0)');

	// build the arrow.
	_this.vis.append("svg:defs").selectAll("marker")
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

	_this.force = d3.layout.force()
		.gravity(.05)
		.charge(-100)
		.distance(100)
		.linkDistance( 100 )
		.size([w, h]);

	function redraw() {
		_this.vis.attr("transform","translate(" + d3.event.translate + ")" + " scale(" + d3.event.scale + ")");
	}

	jsonld.fromRDF(_this.nquads, {format: 'application/nquads'}, function(err, doc) {		
		_this.model = doc;

		console.log( "Model:  ", _this.model );
		$("#ontologie-editor").val( JSON.stringify(_this.model, null, ' ') );

		if ( _this.model[0]["@type"] == "http://www.w3.org/2002/07/owl#Ontology" ) {
			_this.base = encodeURIComponent( _this.model[0]["@id"] );
		}
			
		//var graphId = encodeURIComponent( _this.base );
		$.post( "ajax/get.php", { name: _this.base + ".json" })		
			.done(function( jsondata ) {
				//console.log( "jsondata: ", jsondata );
				if ( jsondata.result && jsondata.content != "" ) {
					_this.storedModel = $.parseJSON( jsondata.content );
					//console.log( "storedModel: ", _this.storedModel );
					console.log( "Gespeicherter Graph: " + _this.base + ".json" );
				} 
				_this.parse();
		});
	});

}

// parse the rdf to json-ld
RDFGraphVis.prototype.parse = function(){
	var _this  = this;

	$("#graph-id").val( encodeURIComponent( _this.base ) );


	var nodeIndexes = new Object();
	var tmpLinks = new Array();

	//_this.merge();
	//console.log( "Model:  ", doc );		

	// walk model
	$.each( _this.model, function(classI, element) {
		//_this.print(element);
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

		switch( element["@type"][0] ) {
			case "http://www.w3.org/2002/07/owl#Ontology":
				// do nothing...
				/*element["@d3"].type = "Model";*/
				break;

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

				nodeIndexes[element["@id"]] = _this.nodes.length;
				_this.nodes.push( element );
				break;

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

					// maybe merge existing position
					if ( _this.storedModel.hasOwnProperty(thisKey) ) {
						thisElement.x = _this.storedModel[ thisKey ].x;
						thisElement.y = _this.storedModel[ thisKey ].y;
					}

					// add as node and link to its class
					thisElement["@d3"].domain = domain["@id"];
					tmpLinks.push( { "source": thisKey, "target": domain["@id"] } );
					nodeIndexes[thisKey] = _this.nodes.length;					
					_this.nodes.push( thisElement );
				});
				break;

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
							nodeIndexes[range["@id"]] = _this.nodes.length;
							_this.nodes.push( externClass );
						}

						// add links and relation
						tmpLinks.push( { "source": domain["@id"], "target": thisKey, } );
						tmpLinks.push( { "source": thisKey, "target": range["@id"], } );
						nodeIndexes[thisKey] = _this.nodes.length;

						// maybe merge existing position
						if ( _this.storedModel.hasOwnProperty(thisKey) ) {
							thisElement.x = _this.storedModel[ thisKey ].x;
							thisElement.y = _this.storedModel[ thisKey ].y;
						}

						_this.nodes.push( thisElement );
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

		_this.links.push( link );

	});		

	//console.log( "nodeIndexes:  ", nodeIndexes );
	//console.log( "Model:  ", _this.model );
	console.log( "Nodes:  ", _this.nodes );
	//console.log( "Links:  ", _this.links );

	_this.print();

	function basename (str) {
		return str.split(/[\\/]/).pop();
	}
} // end of parsing


// print the model as JointJS graph
RDFGraphVis.prototype.print = function(){
	var _this = this;

	// node drag funktion
	// http://bl.ocks.org/norrs/2883411
	var node_drag = d3.behavior.drag()
	    .on("dragstart", dragstart)
	    .on("drag", dragmove)
	    .on("dragend", dragend);	

	// add links
	var link = _this.vis.selectAll(".link")
		.data(_this.links)
		.enter().append("line")
		.attr("class", "link")
		.attr("marker-end", function(d) { if ( d.hasOwnProperty("subClassOf") ) { return "url(#end)" } } )
		.style("stroke-width", "2")
		.style("stroke", "gray");    

		
	// add nodes
	var node = _this.vis.selectAll(".node")
		.data(_this.nodes)
		.enter().append("svg:g")
		.attr("class", "node")
		/*.on("mousedown", function(d) {
			_this.vis.call(d3.behavior.zoom().on("zoom"), null);
		})*/
		.call(node_drag);		

	// add classes
	node.filter(function(d){
		if ( d["@d3"].type == "Class" ) {
			return true;
		}
		}).append("svg:rect")
		.attr("class", "class")
		.attr("x", "-30px")
		.attr("y", "-12px")
		.attr("width", "60px")
		.attr("height", "24px") 		
		.attr("rx", "5").attr("ry", "5")		
		.style("fill", "#4987AC")
		.style("stroke", "#1D3C4F");

	// add classe relations
	node.filter(function(d){
		if ( d["@d3"].type == "ClassRelation" ) {
			return true;
		}
		}).append("svg:polygon")
		.attr("class", "class-relation")
		.attr("points", "-30,0 0,20 30,0 0,-20")
		//.attr("rx", "5").attr("ry", "5")
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

	// set node position if given
	_this.vis.selectAll("g.node").filter(function(d){
		if ( d.hasOwnProperty("x") ) {
			//console.log("g.node fiex pos: ", d);
			d.fixed = true;
			return true;
		}})
		.attr("data-test", "ja");

	//console.log( "Graph:  ", node );

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

	_this.force
		.nodes(_this.nodes)
		.links(_this.links)
		.on("tick", tick)
		.start();

	// drag functions
	function dragstart(d, i) {
	    _this.force.stop() // stops the force auto positioning before you start dragging	    
	}

	function dragmove(d, i) {
	    //console.log( d );
	    d.px += d3.event.dx;
	    d.py += d3.event.dy;
	    d.x += d3.event.dx;
	    d.y += d3.event.dy; 
	    tick(); // this is the key to make it work together with updating both px,py,x,y on d !

	    
	}

	function dragend(d, i) {
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

}

// update the graph
RDFGraphVis.prototype.update = function() {
	var _this = this;

	_this.model = $.parseJSON( $( "#ontologie-editor" ).val() );
	
	this.nodes = new Array();
	this.links = new Array();

	_this.vis.selectAll("g.node").remove();
	_this.vis.selectAll("line").remove();
	
	_this.parse();
}

// save the graph
RDFGraphVis.prototype.save = function() {
	var _this = this;
	var content = new Object();
	var graphId = $("#graph-id").val();
	if ( graphId == "" ) {
		alert( "Please give an unique ID for this Graph" );
		return false;
	}

	$.each( _this.nodes, function(key, element) {

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

	$.post( "ajax/save.php", { name: graphId + ".json", content: content })
		.done(function( jsondata ) {
			if ( jsondata.result ) {
				//$(resultMsg).addClass("text-success");
			} else {
				//$(resultMsg).addClass("text-danger");
			}
			//$(resultMsg).text( jsondata.msg );
			alert( jsondata.msg );
	});	
}