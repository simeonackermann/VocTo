// the RDFGraphvis class
RDFGraphVis = function(data) {
	this.nquads = data;
	this.model = new Array();
	this.subClasses = new Object();	
	this.printedClasses = new Object();
	this.storedModel = new Object();

	this.element = function(elm, x, y, label) {};
	this.link = function(elm1, elm2) {};
	this.erd = null;
	
	this.init();
	return this;
}

// init the graph, element and links
RDFGraphVis.prototype.init = function() {
	var _this = this;

	var graph = new joint.dia.Graph;

	var paper = new joint.dia.Paper({
	    el: $('.container'),
	    width: 800,
	    height: 600,
	    gridSize: 1,
	    model: graph
	});

	_this.erd = joint.shapes.erd;

	_this.element = function(elm, x, y, label) {
	    var cell = new elm({ position: { x: x, y: y }, attrs: { text: { text: label }}});
	    graph.addCell(cell);
	    return cell;
	};

	_this.link = function(elm1, elm2) {
	    var myLink = new _this.erd.Line({ source: { id: elm1.id }, target: { id: elm2.id }});
	    graph.addCell(myLink);
	    return myLink;
	};

}

// parse the rdf to json-ld
RDFGraphVis.prototype.parse = function(){
	var _this  = this;

	jsonld.fromRDF(_this.nquads, {format: 'application/nquads'}, function(err, doc) {		
		_this.model = doc;

		_this.merge();

		console.log( "Model:  ", doc );

		// walk model
		$.each( _this.model, function(key, element) {
			_this.print(element);
		});

		// print links between sub and parent classes
		$.each( _this.subClasses, function(key, subClass) {
			var isa = _this.element(_this.erd.ISA, 0, 0, "ISA");
			_this.link(_this.printedClasses[key], isa);
			_this.link(isa, _this.printedClasses[subClass]);
			
		});			
	});
}

RDFGraphVis.prototype.merge = function(){
	var _this = this;

	_this.storedModel = new Object({
		"http://catalogus-professorum.org/cpm/Person" : new Object({
			"@joint" : new Array( 
				new Object({  "x" : 100, "y" : 100 }) 
			)
		}),
		"http://catalogus-professorum.org/cpm/Professor" : new Object({
			"@joint" : new Array( 
				new Object({  "x" : 100, "y" : 400 }) 
			)
		}),
	});

	console.log("Stored Model:", _this.storedModel);

	$.each( _this.model, function(key, element) {

		if ( _this.storedModel.hasOwnProperty( element["@id"] ) ) {
			//console.log( element, " inGraphData gefunden");
			_this.model[key]["@joint"] = _this.storedModel[element["@id"]]["@joint"];
		}

	});

	//return true;
	/*
	var test = new Array();
	test.push(new Object({
			"@id"	: "http://catalogus-professorum.org/cpm/Person",
			"@type"	: new Array( "http://www.w3.org/2002/07/owl#Class" ),
			"http://www.w3.org/2002/07/owl#bla"	: new Array( "testbla" ),
			//"http://rdfgraphvis.de/joint#x" : new Array("100"),
			"@joint" : new Array( new Object({ "x" : 100, "y": 200 }) ),
	}));

	console.log("test array:", test);

	jsonld.toRDF(test, {format: 'application/nquads'}, function(err, nquads) {
		console.log("test n3:", nquads);

		jsonld.fromRDF(nquads, {format: 'application/nquads'}, function(err, doc) {
			console.log("test n3 to jsonld:", doc);
		});
	});
	*/
}

// print the model as JointJS graph
RDFGraphVis.prototype.print = function(element){
	var _this = this;

	if ( ! element.hasOwnProperty("@type") ) {
		console.log("No @type in: ", element);
		return false;
	}

	if ( ! element.hasOwnProperty("@id") ) {
		console.log("No @id in: ", element);
		return false;
	}

	var label = element["@id"];
	if ( element.hasOwnProperty("http://www.w3.org/2000/01/rdf-schema#label") ) {
		label = element["http://www.w3.org/2000/01/rdf-schema#label"][0]["@value"];
	}

	var x = 0;
	var y = 0;	

	switch( element["@type"][0] ) {
		// print a class
		case "http://www.w3.org/2002/07/owl#Class":
			console.log("Print Class : ", element);
			if ( element.hasOwnProperty("@joint") ) {
				x = element["@joint"][0]["x"];
				y = element["@joint"][0]["y"];
			}
			var thisClass = _this.element(_this.erd.Entity, x, y, label);
			_this.printedClasses[element["@id"]] = thisClass;

			if ( element.hasOwnProperty("http://www.w3.org/2000/01/rdf-schema#subClassOf") ) {
				//  maybe add as subClass -> because its not guaranteed that the parant class was already painted
				$.each( element["http://www.w3.org/2000/01/rdf-schema#subClassOf"], function(key, subClass) {
					_this.subClasses[subClass["@id"]] = element["@id"];
				});
			}
			break;

		// print a property
		case "http://www.w3.org/2002/07/owl#DatatypeProperty":
		case "http://www.w3.org/2002/07/owl#FunctionalProperty":
		case "http://www.w3.org/2002/07/owl#ObjectProperty":			
			if ( ! element.hasOwnProperty("http://www.w3.org/2000/01/rdf-schema#domain") ) {
				console.log("No domain in: ", element);
				return false;
			}
			
			$.each( element["http://www.w3.org/2000/01/rdf-schema#domain"], function(key, domain) {
				if ( ! _this.printedClasses.hasOwnProperty(domain["@id"]) ) {
					console.log("Domain-Class not yet printed...: ", element);
					return false;
				}
				console.log("Print Property : ", element);
				var thisProperty = _this.element(_this.erd.Normal, x, y, label);
				_this.link(thisProperty, _this.printedClasses[domain["@id"]]);
			});
			break;

		default:
			console.log("Unknown @type in: ", element);
			break;
	}
}