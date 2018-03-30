

var falafel = require('falafel');
var falafelMap = require('falafel-map');
var fs = require('fs');
var basename = require('path').basename;
var esprima = require('esprima');
var mergeDeep = require('deepmerge');


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

/** comparator for positions in the form { line: XXX, column: YYY } */
var comparePositions = function (a, b) {
	if (a.line !== b.line) {
		return a.line < b.line ? -1 : 1;
	}
	if (a.column !== b.column) {
		return a.column < b.column ? -1 : 1;
	}
	return 0;
};

function contains(start, end, pos) {
	var startsBefore = comparePositions(start, pos) <= 0;
	var endsAfter    = comparePositions(end,   pos) >= 0;
	return startsBefore && endsAfter;
}

var containsRange = function (start1, end1, start2, end2) {
	return contains(start1, end1, start2) && contains(start1, end1, end2);
}

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

	var escapeRegExp = function(str) {
  		return str.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|\']/g, "\\$&");
	}

	var removeLocalVariable = function(node) {
		parent = node.parent;
	    while ((parent.type != "FunctionDeclaration" && parent.type != "FunctionExpression") && parent.parent != undefined){
	        parent = parent.parent;
	    }
	    if (parent.type == "FunctionDeclaration" || parent.type == "FunctionExpression"){
	    	try { localIndex = parent.localVariables.indexOf(node.source());
    		if (localIndex > -1) parent.localVariables.splice(localIndex, 1);
    		} catch(err) {}
	    }
	}

	var addLocalVariable = function (node) {
	    parent = node.parent;
	    while ((parent.type != "FunctionDeclaration" && parent.type != "FunctionExpression") && parent.parent != undefined){
	        parent = parent.parent;
	    }
	    if (parent.type == "FunctionDeclaration" || parent.type == "FunctionExpression"){
	        if (parent.localVariables == undefined){
	            parent.localVariables = []
	        }
	        if (node.id && parent.localVariables.indexOf(node.id.name) < 0) parent.localVariables.push(node.id.name);
	        else if (parent.localVariables.indexOf(node.source()) < 0) parent.localVariables.push(node.source());
	        return;
	    }

	}

	/* fetches the identifier from the node
	 by recursively referencing the object in case of member expression
	 or returns null if no identifier is found
	 */
	var getIdentifierFromMemberExpression = function (node) {
		// console.log("Finding indentifier from member " + node.source());
		if (node.type == "Identifier"){
			return node;
		}
		if (node.type == "MemberExpression"){
			return getIdentifierFromMemberExpression(node.object)
		}
		return null;
	}

	var getIdentifierFromAssignmentExpression = function (node) {
		// console.log("Finding Identifier from AssignmentExpression " + node.source());
		if (node.type == "Identifier"){
			return node;
		}
		if (node.type == "AssignmentExpression"){
			return getIdentifierFromAssignmentExpression(node.right)
		}
		return null;
	}

	/* 
	Returns 0 for local and -1 for non variables (literals, integers etc)
	Returns 1 for global
	*/
	var IsLocalVariable = function (node){

		if (node == null || typeof(node) == "undefined") return 0;


		else if (node.type == "ConditionalExpression"){
			return (IsLocalVariable(node.consequent) || IsLocalVariable(node.alternate))
		} else if (node.type == "ObjectExpression" || node.type == "Literal" || 
			node.type == "NewExpression" || node.type == "BinaryExpression" || node.type == "LogicalExpression"
			|| node.type == "ArrayExpression" || node.type == "" || node.type == "FunctionExpression" || node.type == "CallExpression"){     // TODO handle all the dom modifications: For now the callexpression like document.getElementbyId('') will be marked as local. 
			return 0;
		} else if (node.type == "UnaryExpression")
			return IsLocalVariable(node.argument)
		else if (node.type == "MemberExpression")
			node = getIdentifierFromMemberExpression(node);
		else if (node.type == "AssignmentExpression")
			node = getIdentifierFromAssignmentExpression(node);

		if (node == null ) return 0;
	    parent = node.parent;
	    while (parent != undefined && parent.parent != undefined){
	        if (parent.type == "FunctionDeclaration" || parent.type == "FunctionExpression"){
	        	functionArguments = getArgs(parent);
	        	if (parent.localVariables == undefined) parent.localVariables = []
	            if (parent.localVariables.includes(node.name) || functionArguments.includes(node.name)){
	                return 0;
	            }
	        }
	        parent = parent.parent;
	    }
	    // console.log("variable: " + node.source() + "is not a local : ");
	    return 1;
	}

	var addGlobalVariable = function (node, otherArgs) {
		// console.log("adding alias " + node.source() + " " + otherArgs.source() + " with type " + otherArgs.type);
		parent = node;
	    while ((parent.type != "FunctionDeclaration" && parent.type != "FunctionExpression") && parent.parent != undefined){
	        parent = parent.parent;
	    }
	    if (parent.type == "FunctionDeclaration" || parent.type == "FunctionExpression"){
	        if (parent.globalVariables == undefined){
	            parent.globalVariables = {};
	        }
	        if (node.source() in parent.globalVariables || Object.values(parent.globalVariables).includes(node.source()) ) return;
	        if (otherArgs != undefined){
        		if (node.id) parent.globalVariables[node.id.name] = otherArgs.source(); // if passing from variable declaration, ie node = "a = 1"
        		else parent.globalVariables[node.source()] = otherArgs.source(); // if being passed from assignment expression, ie node = a
	        } else {
	        	console.log("[global but not alias]probably not going to enter this branch ever");
	        	parent.globalVariables["ERROR"] = (node.source());
	        }
	        try { localIndex = parent.localVariables.indexOf(node.source());
    		if (localIndex > -1) parent.localVariables.splice(localIndex, 1);
    		} catch(err) {}
	    }
	}

	var addGlobalWrites = function(node) {
	    parent = node.parent;
	    while (parent != undefined){
		    
		    if (parent != undefined && ( parent.type == "FunctionDeclaration" || parent.type == "FunctionExpression" )){
		        if (parent.globalWrites == undefined){
		            parent.globalWrites = [];
		        }
		        if (node.id && parent.globalWrites.indexOf(node.id.name) < 0) parent.globalWrites.push(node.id.name);
		        else if (parent.globalWrites.indexOf(node.source()) < 0) parent.globalWrites.push(node.source());
		        return;
		    }	
		    parent = parent.parent;
		}
	}

	var addGlobalReads = function(nodeArray) {
		nodeArray.forEach(function(node){
			_addGlobalReads(node);
		});
	}

	var _addGlobalReads = function(node) {
	    parent = node.parent;
	    while (parent != undefined){
	    
		    if ( parent != undefined &&  (parent.type == "FunctionDeclaration" || parent.type == "FunctionExpression")){
		        if (parent.globalReads == undefined){
		            parent.globalReads = [];
		        }
		        if (node.id && parent.globalReads.indexOf(node.id.name) < 0) parent.globalReads.push(node.id.name);
		        else if (parent.globalReads.indexOf(node.source()) < 0) parent.globalReads.push(node.source());
		        return;
		    }	
		    parent = parent.parent;
		}
	}

	var getArgs = function (node) {
		var args = [];
		if (node.params.length > 0){
			node.params.forEach(function (param) {
				args.push(param.source())
			});
		}
		return args;
	}

	if (!options.execution_cache_toggle ) {
		var prologue = "";
		prologue += template(/*tracer-stub.js{*/fs.readFileSync(__dirname + '/lib/tracer-stub.js', 'utf8')/*}tracer-stub.js*/, { name: options.tracer_name });
		if (options.source_map) prologue += "/*mapshere*/";
		prologue += options.tracer_name + '.add(' + JSON.stringify(options.path) + ', ' + extractTracePoints(content, options.path) + ');\n\n';
	}

	try {
		var fala, update, sourceNodes;

		var functionToMetadata = {};

		var functionNameToLocation = {}; // Dictionary: key is function name, value is an array containing all the locations it was defined. 

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

		var handleBinaryandLogical = function(node) {
			if (node == undefined)
				return [];
			var reads = [];
			// console.log("Handling binary and logical:" + node.source() + "with properties: " + Object.keys(node));
			if (node.type == "Identifier" || node.type == "MemberExpression") {
				reads.push(node)
				return reads
			} else if (node.type == "ObjectExpression") {
				reads = handleObjectExpressions(node);
				return reads;
			}

			reads = reads.concat(handleBinaryandLogical(node.left));
			reads = reads.concat(handleBinaryandLogical(node.right));

			return reads;
		}

		var handleObjectExpressions = function(node) {
			var reads = [];

			node.properties.forEach(function(elem){
				if (elem.value.type == "Identifier")
					reads.push(elem.value)
			});

			return reads;
		}

		var handleMemberExpression = function(node) {
			var reads = [];

			if (node.property.type == "Identifier")
				reads.push(node.property);

			if (node.object.type == "Identifier") {
				reads.push(node.object);
				return reads;
			} else if (node.object.type == "MemberExpression") {
				reads = reads.concat(handleMemberExpression(node.object));
				return reads;
			}
			return reads;
		}

		var handleReads = function(node) {
			/*
			The following read types are available for the assignment expression RHS:
			- Identifier
			- Literal (ignored)
			- CallExpression
			- Object Expression 
			- Logical Expression
			- Binary Expression
			- Unary expression
			- New expression
			- Array expression
			- Memberexpression

			First let's slice out all the variables read.
			Then pass these through the local/global analysis 

			*/

			// console.log("Called read array handler" + node.source());
			var readArray = [];
			if (node.type == "Identifier")
				readArray.push(node)
			else if (node.type == "BinaryExpression" || node.type == "LogicalExpression") {
				readArray = handleBinaryandLogical(node)
			}
		    else if (node.type == "ObjectExpression")
				readArray = handleObjectExpressions(node)
			else if (node.type == "UnaryExpression") {
				if (node.argument.type == "Identifier")
					readArray.push(node.argument);
			} else if (node.type == "ConditionalExpression") {
				readArray = handleBinaryandLogical(node.test);
				if (node.consequent.type == "Identifier") readArray.push(node.consequent);
				if (node.alternate.type == "Identifier") readArray.push(node.alternate);
			} else if (node.type == "MemberExpression") {
				readArray.push(node);
			} else if (node.type == "ArrayExpression") {
				node.elements.forEach(function (elem) {
					if (elem.type == "Identifier")
						readArray.push(elem);
				});
			}
			
			if (readArray == null) return [];
			// console.log("Read array: " + JSON.stringify(readArray));
			var globalReads = [];
			readArray.forEach(function(read){
				if (IsLocalVariable(read) > 0) {
					globalReads.push(read);
					// globalReads.push("\'" + escapeRegExp(read.source()) + "\'");
				}

			});
			// console.log("However only these are the global ones:  " + JSON.stringify(globalReads));
			return globalReads;
		}

		// TODO how to handle merging of globalAliases from two functions with same key
		var mergeDicts = function(dict1, dict2) {
			// console.log(dict1);
			dict1 = JSON.parse(dict1);
			dict2 = JSON.parse(dict2);
			var excludeKey = "nodeId";
			// Since we already know that the dictionary value type is array, we will simply append it.
			for (var key in dict2) {
				if (key != excludeKey){
					if (key != "globalAlias"){
						if (dict1[key]){
							dict1[key] = dict1[key].concat(dict2[key]);
						}
						else {
							dict1[key] = dict2[key];
						}
					} else {
						if (dict1[key]){
							for (var key2 in dict2[key]){
								dict1[key][key2] = dict2[key][key2];
							}
						}
						else {
							dict1[key] = dict2[key];
						}
					}
				}
			}
			// console.log("Returned: "  + JSON.stringify(dict1));
			return JSON.stringify(dict1);
		}


		var propogateSignature = function(node, signature) {
			// console.log("propogating: " + signature);
			parent = node.parent;
			while (parent != undefined ) {
				if ((parent.type == "FunctionDeclaration" || parent.type == "FunctionExpression")){
					// console.log("calling merge deep from outside");
					functionToMetadata[makeId('function', options.path, parent.loc)] = JSON.stringify(
						mergeDeep(JSON.parse(functionToMetadata[makeId('function', options.path, parent.loc)]), JSON.parse(signature)));
				}
				parent = parent.parent;
			}
		}

		var replaceAliasesWithActuals = function(signature){
			signature = JSON.parse(signature);
			if (signature["globalAlias"]){
				if (signature.globalWrites) {
					signature.globalWrites.forEach(function(writeKey, it){
						if (writeKey in signature.globalAlias)
							signature.globalWrites[it] = signature.globalAlias[writeKey];
					});
				}
			}
			return signature;

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


			if (node.type === 'FunctionExpression' || node.type === 'FunctionDeclaration') {
				var attrs = { localVars: node.localVariables, globalAlias: node.globalVariables, globalReads: node.globalReads, globalWrites : node.globalWrites  };
				var args = JSON.stringify(attrs);

				// if (node.id) {
				// 	functionToMetadata[node.id.name] = args;
				// }
				// else {
				// 	var index = makeId('function', options.path, node.loc);
				// 	if (node.parent.type == "VariableDeclarator")
				// 		index = node.parent.id.name;
				// 	else if (node.parent.type == "AssignmentExpression") {
				// 		var identifier = getIdentifierFromMemberExpression(node.parent.left);
				// 		index = identifier ? identifier.name: index;
				// 	}
				// 	functionToMetadata[index] = args;
				// }

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
					readArray = handleReads(node.test);
					// console.log("extracted reads from if condition: " + JSON.stringify(readArray));
					addGlobalReads(readArray);
			} else if ( (node.type === 'VariableDeclaration' || node.type === 'VariableDeclarator')) {
				if (node.type == "VariableDeclarator"){
					if (node.parent.source().includes("let ")) {
						addLocalVariable(node);
					}
					else if (node.init) {
						if (IsLocalVariable(node.init) == 0) {
							addLocalVariable(node);
						} else {
							// removeLocalVariable(node); The function add global already removes it from the local
							addGlobalVariable(node,node.init);
						}
					} else {
						addLocalVariable(node);
					}
			    }
			    update(node, sourceNodes(node));
			
			// Handles any global variable being assigned any value
			// or a local variable becoming an alias of a global variable
			} else if (node.type == "AssignmentExpression"){
				if (IsLocalVariable(node.left) > 0){
					// addGlobalVariable(node.left);
					addGlobalWrites(node.left);
					// console.log("source: " + node.source() + " properties : " + Object.keys(node));
					var readArray = [];
					readArray = handleReads(node.right);
					addGlobalReads(readArray);

				} else if (IsLocalVariable(node.right) > 0){
					addGlobalVariable(node.left, node.right);
				} else {
					addLocalVariable(node.left);
				}
			} 
		});


		var buildArgs = function (args) {
			if (args) {
				var modifiedArgArray = [];
				args.forEach(function(arg){
					modifiedArgArray.push("\'" + escapeRegExp(arg) + "\'");
					modifiedArgArray.push("typeof " +  arg + "=='undefined'?null:" + arg );
				});

				return modifiedArgArray;
			}
		}

		// console.log("functions with signatures after first pass: " + Object.keys(functionToMetadata).length);
		// console.log("function name to location map: " + JSON.stringify(functionNameToLocation));
		// Second pass of the entire code to pass children's signature upwards
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
			}
			else if (node.type == "CallExpression") {
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
							if (containsRange(node.parent.loc.start, node.parent.loc.end, loc.start, loc.end))
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
				args = replaceAliasesWithActuals(args);

				// break into separate arguments
				var separateWrites = buildArgs(args.globalWrites);
				var separateReads = buildArgs(args.globalReads);
				var separateAlias = args.globalAlias;
				var localVars = args.localVars;
				var _traceBegin = "if (" + options.tracer_name + ".compareAndCache(";// + args + ")) return;"
				var _traceEnd = options.tracer_name + ".dumpCache(";// + args + ");";
				update(node.body, '{', _traceBegin, JSON.stringify(index) ,', arguments,[' ,  separateReads , '],',JSON.stringify(args),')) return;',
				 'try { ', sourceNodes(node.body), '\n} catch (e) {console.log("ERROR while replaying cache" + e + e.stack)} finally {', _traceEnd,
				  JSON.stringify(index) ,',[' , separateWrites , ']); }}');
			}
		});

		if (options.source_map) {
			var addMapSrc = options.tracer_name + ".addSourceMap(" + JSON.stringify(options.path) + ", " + JSON.stringify(m.map()) + ");";
			var finalSource = m.toString().replace(/\/\*mapshere\*\//, addMapSrc);
			processed = {
				map: m.map,
				toString: function () { return finalSource; },
			};
		} else {
			processed = m;
		}

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
