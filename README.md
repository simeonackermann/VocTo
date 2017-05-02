
# VocTool

is an OWL/RDF vocabulary graphical visualisation and editing tool. Its implemented in JS/PHP/HTML and based on the JavaScript library [D3](http://d3js.org/).

**Screenshot:**

![](https://github.com/simeonackermann/VocTo/raw/master/screenshot.png)


# Getting started

- save your RDF vocabulary as [N3](http://www.w3.org/TeamSubmission/n3/) notation in data/filename.n3
- open index.html for an example implementation

# RDF / OWL notation

Currently the tool does not cover the hole N3 notation!
The following features are implemented right now to declare classes, properties and relations.

As type (class/property/relation), declare http://www.w3.org/1999/02/22-rdf-syntax-ns#type as:

Classes:

- http://www.w3.org/2000/01/rdf-schema#Class
- http://www.w3.org/2002/07/owl#Class

Properties:

- http://www.w3.org/1999/02/22-rdf-syntax-ns#Property
- http://www.w3.org/2002/07/owl#DatatypeProperty
- http://www.w3.org/2002/07/owl#FunctionalProperty

Relations:

- http://www.w3.org/2002/07/owl#ObjectProperty

The followoing attributes are implemented to show details on your graph:

Class-Attributes:

- http://www.w3.org/2000/01/rdf-schema#subClassOf
- http://www.w3.org/2000/01/rdf-schema#label
- http://www.w3.org/2000/01/rdf-schema#comment

Property-Attributes

- http://www.w3.org/2000/01/rdf-schema#domain
- http://www.w3.org/2000/01/rdf-schema#label
- http://www.w3.org/2000/01/rdf-schema#comment

Relation-Attributes:

- http://www.w3.org/2000/01/rdf-schema#domain
- http://www.w3.org/2000/01/rdf-schema#range
- http://www.w3.org/2000/01/rdf-schema#label
- http://www.w3.org/2000/01/rdf-schema#comment