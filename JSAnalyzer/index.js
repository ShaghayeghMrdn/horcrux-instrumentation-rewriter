

var falafel = require('falafel');
var falafelMap = require('falafel-map');
var fs = require('fs');
var basename = require('path').basename;
var esprima = require('esprima');


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

/**
 * injects code for tracing the execution of functions.
 *
 * the bodies of named functions are:
 *  - wrapped in try {} finally {},
 *  - have a call to traceEnter is prepended, and
 *  - have a call to traceExit added to the finally block
 *
 * here is an example:
 *
 *   function foo() {...}
 *     -->
 *   function foo() {
 *     tracer.traceEnter({
 *       start: { line: ..., column: ... },
 *       end: { line: ..., column: ... },
 *       vars: { a: a, b: b, ... }
 *     });
 *     try {
 *       ...
 *     } finally {
 *       tracer.traceExit({
 *         start: { line: ..., column: ... },
 *         end: { line: ..., column: ... }
 *       });
 *     }
 *   }
 *
 * anonymous functions get the same transformation, but they're also
 * wrapped in a call to traceFunCreate:
 *
 *   function () {...}
 *     -->
 *   tracer.traceFunCreate({
 *     start: { line: ..., column: ... },
 *     end: { line: ..., column: ... }
 *   }, function () {...})
 */
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
		}

		else if (node.type == "ObjectExpression" || node.type == "Literal" || 
			node.type == "NewExpression" || node.type == "BinaryExpression" || node.type == "LogicalExpression"
			|| node.type == "ArrayExpression" || node.type == ""){
			return 0;
		}

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
		parent = node.parent;
	    while ((parent.type != "FunctionDeclaration" && parent.type != "FunctionExpression") && parent.parent != undefined){
	        parent = parent.parent;
	    }
	    if (parent.type == "FunctionDeclaration" || parent.type == "FunctionExpression"){
	        if (parent.globalVariables == undefined){
	            parent.globalVariables = {};
	        }
	        if (node.source() in parent.globalVariables || Object.values(parent.globalVariables).includes(node.source()) ) return;
	        if (otherArgs != undefined){
        		if (node.id) parent.globalVariables[node.id.name] = otherArgs.name; // if passing from variable declaration, ie node = "a = 1"
        		else parent.globalVariables[node.name] = otherArgs.name; // if being passed from assignment expression, ie node = a
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
			parent = node.parent;
			while (parent != undefined ) {
				if ((parent.type == "FunctionDeclaration" || parent.type == "FunctionExpression")){
					if (parent.id)
						functionToMetadata[parent.id.name] = mergeDicts(functionToMetadata[parent.id.name], signature);
					else functionToMetadata[makeId('function', options.path, parent.loc)] = mergeDicts(functionToMetadata[makeId('function', options.path, parent.loc)], signature);
				}
				parent = parent.parent;
			}
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
				var attrs = { nodeId: makeId('function', options.path, node.loc), localVars: node.localVariables, globalVars: node.globalVariables };

				if (!options.execution_cache_toggle) {
					// convert the arguments to strings
					var args = JSON.stringify(attrs);
					var entryArgs = args.slice(0, args.length - 1) + ', arguments: ' + options.tracer_name + '.Array.prototype.slice.apply(arguments), this: this }';
					var exitArgs = args;

					if (options.trace_function_entry) {
						// insert the traces for when the function is called and when it exits
						var traceBegin = options.tracer_name + '.traceEnter(' + entryArgs + ');';
						var traceError = options.tracer_name + '.traceExceptionThrown(' + exitArgs + ', e); throw e;';
						var traceEnd = ';' + options.tracer_name + '.traceExit(' + exitArgs + ');';

						// add line break after oldBody in case it ends in a //-comment
						// update(node.body, '{ ', traceBegin, ' try { ', sourceNodes(node.body), '\n } catch (e) { ', traceError, ' } finally { ', traceEnd, ' } }');
					}
				} else {
					var attrs = { nodeId: makeId('function', options.path, node.loc),localVars: node.localVariables, globalAlias: node.globalVariables, globalReads: node.globalReads, globalWrites : node.globalWrites  };
					var args = JSON.stringify(attrs);
					var traceBegin = "if (" + options.tracer_name + ".compareAndCache(" + args + ")) return;"
					var traceEnd = options.tracer_name + ".dumpCache(" + args + ");";

					update(node.body, '{', traceBegin, 'try { ', sourceNodes(node.body), '\n} catch (e) {console.log("ERROR while replaying cache")} finally {', traceEnd, '}}');
					if (node.id)
						functionToMetadata[node.id.name] = args;
					else 
						functionToMetadata[makeId('function', options.path, node.loc)] = args;
				}

				if (node.type === 'FunctionExpression' && options.trace_function_creation) {
					console.log("[TRACER.js][743] tracing anonyomous functions");
					if (node.parent.type !== 'Property' || node.parent.kind === 'init') {
						update(node, options.tracer_name, '.traceFunCreate(', sourceNodes(node), ', ', JSON.stringify(functionSources[attrs.nodeId]), ')');
					}
				}
			} else if (node.type === 'CallExpression' && !options.execution_cache_toggle) {
				if (options.trace_function_calls) {
					var id = makeId("callsite", loc.path, loc);

					if (node.callee.source() !== "require") {
						if (node.callee.type === 'MemberExpression') {
							if (node.callee.computed) {
								update(node.callee, ' ', options.tracer_name, '.traceFunCall({ this: ', sourceNodes(node.callee.object), ', property: ', sourceNodes(node.callee.property), ', nodeId: ', JSON.stringify(id), ', vars: {} })');
							} else {
								update(node.callee, ' ', options.tracer_name, '.traceFunCall({ this: ', sourceNodes(node.callee.object), ', property: "', sourceNodes(node.callee.property), '", nodeId: ', JSON.stringify(id), ', vars: {} })');
							}
						} else {
							update(node.callee, ' ', options.tracer_name, '.traceFunCall({ func: ', sourceNodes(node.callee), ', nodeId: ', JSON.stringify(id), ', vars: {} })');
						}
					}
				}
			} else if (node.type == "ExpressionStatement"){
				
			} else if (/Statement$/.test(node.type) && !options.execution_cache_toggle) {
				var semiColonStatements = ["BreakStatement", "ContinueStatement", "ExpressionStatement", "ReturnStatement", "ThrowStatement"];
				if (node.type === "ReturnStatement" && node.argument) {
					if (options.trace_function_entry) {
						var sNodes = sourceNodes(node).slice(6);
						var semicolon = sNodes.slice(-1)[0] === ";";
						if (semicolon) sNodes = sNodes.slice(0, -1);
						update(node, "return ", options.tracer_name, ".traceReturnValue(", sNodes, ")", (semicolon ? ";" : ""), "\n");
					}
				} else if (node.type === 'IfStatement') {
					if (options.trace_branches) {
						// TODO
					}
				} else if (semiColonStatements.indexOf(node.type) !== -1) {
					if (!/;$/.test(node.source())) {
						update(node, sourceNodes(node), ";");
					}
				}
				update(node, sourceNodes(node));
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
					// console.log("Read array is : " + readArray);
					// update(node, node.left.source() , node.operator , options.tracer_name , ".setValue(" , node.right.source() , 
					// 	", \'" , escapeRegExp(node.left.source()) , "\', typeof(" , node.left.source() , ')== "undefined" ? null :' 
					// 	, node.left.source() , ",[" , readArray , "])" );
					// update(node,node.left.source(),node.operator, options.tracer_name,'.setValue(',node.right.source(),',','\'',escapeRegExp(node.left.source()),
					// 	'\'',', typeof(',node.left.source(),') == "undefined" ? null : ',node.left.source(),',[',readArray,'],',')');
					// update(node, node.left.source(), node.operator, options.tracer_name, '.setValue(', node.right.source(),',',node.left,')');

				} else if (IsLocalVariable(node.right) > 0){
					//the left node is local, however the right node is global, 
					//therefore left becomes an alias to a global
					// or a local is 
					// therefore no longer local
					// also, now track the global variable being aliased
					// console.log("ENtered condition where left: " + node.left.source() + "is local but right is global: " + node.right.source());
					// removeLocalVariable(node.left);
					addGlobalVariable(node.left, node.right);
				} else {
					addLocalVariable(node.left);
				}
			} else if (node.type === 'SwitchStatement' && !options.execution_cache_toggle) {
				if (options.trace_switches) {
					for (var i in node.cases) {
						var c = node.cases[i];
						if (c.consequent.length > 0) {
							// it's impossible to get the source minus the "case 0:" at the beginning,
							// so calculate the offset of the first statement of the consequence, then slice off the front
							var relStart = {
								line: c.consequent[0].loc.start.line - c.loc.start.line,
								column: c.consequent[0].loc.start.column - c.loc.start.column
							};
							var source = c.source();
							var lines = c.source().split("\n").slice(relStart.line);
							lines[0] = lines[0].slice(relStart.column);
							var sourceWithoutCase = lines.join('\n');

							var attrs = { path: c.loc.path, start: c.loc.start, end: c.loc.end };
							console.log({
								attrs: attrs,
								originalSource: sourceWithoutCase
							});
						}
					}
				}
			} else if (node.type === 'ForStatement' || node.type === 'ForInStatement') {
				if (options.trace_loops) {
					node.body;
				}
			} else if (node.type === 'WhileStatement' || node.type === 'DoWhileStatement') {
				if (options.trace_loops) {
					node.body;
				}
			}
		});
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
				if (node.callee.name in functionToMetadata){
					propogateSignature(node, functionToMetadata[node.callee.name]);
				}
			} else if (node.type == "FunctionDeclaration" || node.type == "FunctionExpression") {
				if (node.id)
					var args = functionToMetadata[node.id.name];
				else var args = functionToMetadata[makeId('function', options.path, node.loc)];
				var traceBegin = "if (" + options.tracer_name + ".compareAndCache(" + args + ")) return;"
				var traceEnd = options.tracer_name + ".dumpCache(" + args + ");";
				update(node.body, '{', traceBegin, 'try { ', sourceNodes(node.body), '\n} catch (e) {console.log("ERROR while replaying cache" + e + e.stack)} finally {', traceEnd, '}}');
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
