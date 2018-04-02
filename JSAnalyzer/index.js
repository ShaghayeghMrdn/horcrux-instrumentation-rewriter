

var falafel = require('falafel');
var falafelMap = require('falafel-map');
var fs = require('fs');
var basename = require('path').basename;
var esprima = require('esprima');
var mergeDeep = require('deepmerge');
var scope = require('./scopeAnalyzer.js');
var util = require('./util.js');
var signature = require('./signature.js');

// adds keys from options to defaultOptions, overwriting on conflicts & returning defaultOptions
function mergeInto(options, defaultOptions) {
	for (var key in options) {
		if (options[key] !== undefined) {
			defaultOptions[key] = options[key];
		}
	}
	return defaultOptions;
}

function template(s, vars) {
	for (var p in vars) {
		s = s.replace(new RegExp('{' + p + '}', 'g'), vars[p]);
	}
	return s;
}

/**
 * options:
 *   name (__tracer): name for the global tracer object
 *   nodejs (false): true to enable Node.js-specific functionality
 *   maxInvocationsPerTick (4096): stop collecting trace information for a tick
 *       with more than this many invocations
 **/
function instrumentationPrefix(options) {
	options = mergeInto(options, {
		name: '__tracer',
		nodejs: false,
		maxInvocationsPerTick: 28192,
	});

	// the inline comments below are markers for building the browser version of fondue
	var tracerSource = /*tracer.js{*/fs.readFileSync(__dirname + '/tracer.js', 'utf8')/*}tracer.js*/;
	return template(tracerSource, {
		name: options.name,
		version: JSON.stringify(require('./package.json').version),
		nodejs: options.nodejs,
		maxInvocationsPerTick: options.maxInvocationsPerTick,
		e2eTesting: options.e2eTesting,
	});
}

/**
 * options:
 *   path (<anonymous>): path of the source being instrumented
 *       (should be unique if multiple instrumented files are to be run together)
 *   include_prefix (true): include the instrumentation thunk
 *   tracer_name (__tracer): name for the global tracer object
 *   nodejs (false): true to enable Node.js-specific functionality
 *   maxInvocationsPerTick (4096): stop collecting trace information for a tick
 *       with more than this many invocations
 **/
function instrument(src, options) {
	var defaultOptions = {
		include_prefix: true,
		tracer_name: '__tracer',
		e2eTesting: false,
	};
	options = mergeInto(options, defaultOptions);
	var prefix = '', shebang = '', output, m;

	if (m = /^(#![^\n]+)\n/.exec(src)) {
		shebang = m[1];
		src = src.slice(shebang.length);
	}

	if (options.include_prefix) {
		prefix += instrumentationPrefix(options);
	}

	if (src.indexOf("/*theseus" + " instrument: false */") !== -1) {
		output = shebang + prefix + src;
	} else {
		var m = traceFilter(src, {
			prefix: prefix,
			path: options.path,
			tracer_name: options.tracer_name,
			sourceFilename: options.sourceFilename,
			generatedFilename: options.generatedFilename,
			execution_cache_toggle: options.execution_cache_toggle,
		});
		output = {
			map: m.map,
			toString: function () {
				return shebang + m.toString();
			},
		};
	}

	return output;
}



var makeId = function (type, path, loc) {
	return path + '-'
	     + type + '-'
	     + loc.start.line + '-'
	     + loc.start.column + '-'
	     + loc.end.line + '-'
	     + loc.end.column;
};

var traceFilter = function (content, options) {
	if (content.trim() === '') {
		return content;
	}
	var defaultOptions = {
		path: '<anonymous>',
		prefix: '',
		tracer_name: '__tracer',
		trace_function_entry: true,
		trace_function_creation: false,
		trace_function_calls: false,
		trace_branches: false,
		trace_switches: false,
		trace_loops: false,
		source_map: false,
		execution_cache_toggle : 0,
	};
	options = mergeInto(options, defaultOptions);

	var processed = content;
	var functionSources = {};

	var addCallees = function(node) {
	    parent = node.parent;
	    while (parent != undefined){
	    
		    if ( parent != undefined &&  (parent.type == "FunctionDeclaration" || parent.type == "FunctionExpression")){
		     if (parent.listOfCallees == undefined)
		     	parent.listOfCallees = [];   
		    }

		}		
	}

	if (!options.execution_cache_toggle ) {
		var prologue = "";
		prologue += template(/*tracer-stub.js{*/fs.readFileSync(__dirname + '/lib/tracer-stub.js', 'utf8')/*}tracer-stub.js*/, { name: options.tracer_name });
		if (options.source_map) prologue += "/*mapshere*/";
		prologue += options.tracer_name + '.add(' + JSON.stringify(options.path) + ', ' + extractTracePoints(content, options.path) + ');\n\n';
	}

	try {
		var fala, update, sourceNodes, functionToMetadata = {}, functionNameToLocation = {}; // Dictionary: key is function name, value is an array containing all the locations it was defined. 

		var ASTNodes = []; // List of all the nodes in the abstract syntax tree
		var functionToCallees = {};

		if (options.source_map) {
			fala = falafelMap;
			update = function (node) {
				node.update.apply(node, Array.prototype.slice.call(arguments, 1));
			};
			sourceNodes = function (node) {
				return node.sourceNodes();
			};
		} else {
			var fala = function () {
				var m = falafel.apply(this, arguments);
				return {
					map: function () { return '' },
					toString: function () { return m.toString() },
				};
			};
			var update = function (node) {
				node.update(Array.prototype.slice.call(arguments, 1).join(''));
			};
			var sourceNodes = function (node) {
				return node.source();
			};
		}

		var customMergeDeep = function (signature1, signature2) {

			for (let key in signature1){
				// console.log("iterating through the key: " + key + Object.keys(signature1));;
				if (signature1[key] && signature1[key].constructor == Array) {
					if (signature2[key]) {
						for (let elem in signature2[key]) {
							signature1[key].push(signature2[key][elem]);
						}
					}
				} else if (signature1[key] && signature1[key].constructor == Object){
					if (signature2[key]) {
						for (let elem in signature2[key]) {
							signature1[key][elem] = signature2[key][elem];
						}
					}
				}
			}
		}

		var propogateSignature = function(node, signature) {
			// console.log("propogating: " + signature);
			parent = node.parent;
			while (parent != undefined ) {
				if ((parent.type == "FunctionDeclaration" || parent.type == "FunctionExpression")){
					// console.log("calling merge deep from outside");
					customMergeDeep(functionToMetadata[makeId('function', options.path, parent.loc)], signature);
				}
				parent = parent.parent;
			}
		}

		var replaceAliasesWithActuals = function(signature){
			if (signature["globalAlias"]){
				if (signature.globalWrites) {
					signature.globalWrites.forEach(function(writeKey, it){
						// var matchIndex = Object.keys(signature.globalAlias).map(function(e){return e.source()}).indexOf(writeKey.source());
						if ( writeKey.source() in signature.globalAlias)
							signature.globalWrites[it].update(signature.globalAlias[writeKey.source()].source());
					});
				}
				if (signature.globalReads) {
					signature.globalReads.forEach(function(writeKey, it){
						// var matchIndex = Object.keys(signature.globalAlias).map(function(e){return e.source()}).indexOf(writeKey.source());
						if ( writeKey.source() in signature.globalAlias)
							signature.globalReads[it].update(signature.globalAlias[writeKey.source()].source());
					});
				}
			}
			return signature;

		}

		var cleanupHoistedVariables = function(node) {
			removeLocalVariables(node);
		}


		var buildArgs = function (args) {
			if (args) {
				var modifiedArgArray = [];
				args.forEach(function(arg){
					modifiedArgArray.push("\'" + util.escapeRegExp(arg) + "\'");
					modifiedArgArray.push("typeof " +  arg + "=='undefined'?null:" + arg );
				});

				return modifiedArgArray;
			}
		}

		var zip= rows=>rows[0].map((_,c)=>rows.map(row=>row[c]));

		var printFriendlyAlias = function(obj) {
			var output = {};
			for (let key in obj){
				output[key] = obj[key].source();
			}

			return output;
		}

		m = fala({
			source: content,
			loc: true,
			sourceFilename: options.sourceFilename || options.path,
			generatedFilename: options.generatedFilename || options.path,
		}, function (node) {
			var loc = {
				path: options.path,
				start: node.loc.start,
				end: node.loc.end
			};

			// Add every node to the list
			ASTNodes.push(node);

			if (node.type === 'FunctionExpression' || node.type === 'FunctionDeclaration') {
				var args = { localVars: node.localVariables, globalAlias: node.globalAlias, globalReads: node.globalReads, globalWrites : node.globalWrites  };

				var index = makeId('function', options.path, node.loc);
				functionToMetadata[index] = args;
				var functionName;
				if (node.id) functionName = node.id.name;
				else {
					if (node.parent.type == "VariableDeclarator")
						functionName = node.parent.id.name;
					else if (node.parent.type == "AssignmentExpression") {
						functionName = node.parent.left.source();
					}				
				}

				if (functionName){
					if (!(functionNameToLocation[functionName]))
						functionNameToLocation[functionName] = [];
					functionNameToLocation[functionName].push(node.loc);
				}	
			} else if (node.type == "IfStatement") {
					var readArray = [];
					readArray = signature.handleReads(node.test);
					scope.addGlobalReads(readArray);
			} else if ( (node.type === 'VariableDeclaration' || node.type === 'VariableDeclarator')) {
				if (node.type == "VariableDeclarator"){
					if (node.parent.source().includes("let ")) {
						scope.addLocalVariable(node);
					}
					else if (node.init) {
						if (scope.IsLocalVariable(node.init) == 0) {
							scope.addLocalVariable(node);
						} else {
							// removeLocalVariable(node); The function add global already removes it from the local
							scope.addGlobalAlias(node,node.init);
						}
					} else {
						scope.addLocalVariable(node);
					}
			    }
			    // update(node, sourceNodes(node));
			
			// Handles any global variable being assigned any value
			// or a local variable becoming an alias of a global variable
			} else if (node.type == "AssignmentExpression"){
				if (scope.IsLocalVariable(node.left) > 0){
					// addGlobalVariable(node.left);
					scope.addGlobalWrites(node.left);
					// console.log("source: " + node.source() + " properties : " + Object.keys(node));
					var readArray = [];
					readArray = signature.handleReads(node.right);
					scope.addGlobalReads(readArray);

				} else if (scope.IsLocalVariable(node.right) > 0){
					scope.addGlobalAlias(node.left, node.right);
				} else {
					scope.addLocalVariable(node.left);
				}
			} 
		});

		ASTNodes.forEach(function(node) {
			if (node.type === "Program") {
				if (!options.execution_cache_toggle) {
					var info = { nodeId: makeId("toplevel", options.path, node.loc) };
					var arg = JSON.stringify(info);

					update(node,
						options.prefix,
						prologue,
						options.tracer_name, '.traceFileEntry(' + arg + ');\n',
						'try {\n', sourceNodes(node), '\n} finally {\n',
						options.tracer_name, '.traceFileExit(' + arg + ');\n',
						'}');
				} else {
					update(node, options.prefix,
						'try {\n', sourceNodes(node), '\n} finally {}',)
				}
			} else if (node.type == "IfStatement") {
					var readArray = [];
					readArray = signature.handleReads(node.test);
					scope.addGlobalReads(readArray);
			} else if ( (node.type === 'VariableDeclaration' || node.type === 'VariableDeclarator')) {
				if (node.type == "VariableDeclarator"){
					if (node.parent.source().includes("let ")) {
						scope.addLocalVariable(node);
					}
					else if (node.init) {
						if (scope.IsLocalVariable(node.init) == 0) {
							scope.addLocalVariable(node);
						} else {
							// removeLocalVariable(node); The function add global already removes it from the local
							scope.addGlobalAlias(node,node.init);
						}
					} else {
						scope.addLocalVariable(node);
					}
			    }
			    // update(node, sourceNodes(node));
			
			// Handles any global variable being assigned any value
			// or a local variable becoming an alias of a global variable
			} else if (node.type == "AssignmentExpression"){
				if (scope.IsLocalVariable(node.left) > 0){
					// addGlobalVariable(node.left);
					scope.addGlobalWrites(node.left);
					// console.log("source: " + node.source() + " properties : " + Object.keys(node));
					var readArray = [];
					readArray = signature.handleReads(node.right);
					scope.addGlobalReads(readArray);

				} else if (IsLocalVariable(node.right) > 0){
					scope.addGlobalAlias(node.left, node.right);
				} else {
					scope.addLocalVariable(node.left);
				}
			} else if (node.type == "CallExpression") {
				/*
				There are three types of call expressions to be taken care of while propagating signature:
					- regular expression which was defined in this script, propagate
					- regular expression which was not defined in this script ( ie a native function), therefore no propagation for this one
					- non regular expression, ie a function expression and call expression at the same time, propagate
					- regular expression which was defined multiple times, therefore look through all the definitions and then decide. 
				*/
				// console.log("propogateSignature for " + node.source() + " with location " + JSON.stringify(node.loc)) ;
				var metadata;
				var immediatelyInvoked = false;
				if (node.callee.type == "FunctionExpression") immediatelyInvoked = true;
				if (functionNameToLocation[node.callee.source()]){
					if (functionNameToLocation[node.callee.source()].length == 1)
						metadata = makeId('function', options.path, functionNameToLocation[node.callee.source()][0]);
					else {
						functionNameToLocation[node.callee.name].forEach(function(loc){
							if (util.containsRange(node.parent.loc.start, node.parent.loc.end, loc.start, loc.end))
									metadata = makeId('function', options.path, loc);
						});
					}
				}
				// console.log("metadata is " + metadata + " propogating: " + functionToMetadata[metadata]);
				if (metadata)
					propogateSignature(node, functionToMetadata[metadata]);
				else if (immediatelyInvoked) propogateSignature(node, functionToMetadata[makeId('function', options.path, node.loc)])

			} else if (node.type == "FunctionDeclaration" || node.type == "FunctionExpression") {
				// console.log(JSON.stringify(functionToMetadata));
				var index = makeId('function', options.path, node.loc);
				var args = functionToMetadata[index];

				// cleanupHoistedVariables(node);
				args = replaceAliasesWithActuals(args);

				// break into separate arguments
				var separateReads = [];
				var separateWrites = [];
				if (args.globalWrites) separateWrites = buildArgs(args.globalWrites.map(function(e){return e.source()}));
				if (args.globalReads) separateReads = buildArgs(args.globalReads.map(function(e){return e.source()}));

				//Stringify the args object
				if (args.globalWrites) args.globalWrites = args.globalWrites.map(function(e){return e.source()});
				if (args.globalReads) args.globalReads = args.globalReads.map(function(e){return e.source()});
				if (args.localVars) args.localVars = args.localVars.map(function(e){return e.source()});
				if (args.globalAlias) args.globalAlias = printFriendlyAlias(args.globalAlias);
				// if (args.globalAlias) args.globalAlias = zip([Object.keys(args.globalAlias.map(function(e){return e.source()})), Object.values(args.globalAlias).map(function(e){return e.source()})]);
				var _traceBegin = "if (" + options.tracer_name + ".compareAndCache(";// + args + ")) return;"
				var _traceEnd = options.tracer_name + ".dumpCache(";// + args + ");";
				update(node.body, '{', _traceBegin, JSON.stringify(index) ,', arguments,[' ,  separateReads , '],',JSON.stringify(args),')) return;',
				 'try { ', sourceNodes(node.body), '\n} catch (e) {console.log("ERROR while replaying cache" + e + e.stack)} finally {', _traceEnd,
				  JSON.stringify(index) ,',[' , separateWrites , ']); }}');
			}
		});

	processed = m;

	} catch (e) {
		console.error('exception during parsing', options.path, e.stack);
		return options.prefix + content;
	}

	return processed;
};


module.exports = {
	instrument: instrument,
	instrumentationPrefix: instrumentationPrefix,
};
