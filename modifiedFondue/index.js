

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
		maxInvocationsPerTick: 8192,
		enableWindowDiffing: false,
	});

	// the inline comments below are markers for building the browser version of fondue
	var tracerSource = /*tracer.js{*/fs.readFileSync(__dirname + '/lib/tracer.js', 'utf8')/*}tracer.js*/;
	return template(tracerSource, {
		name: options.name,
		version: JSON.stringify(require('./package.json').version),
		nodejs: options.nodejs,
		maxInvocationsPerTick: options.maxInvocationsPerTick,
		enableWindowDiffing: options.enableWindowDiffing,
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
	};
	options = mergeInto(options, defaultOptions);
	var prefix = '', shebang = '', output, m;

	if (m = /^(#![^\n]+)\n/.exec(src)) {
		shebang = m[1];
		src = src.slice(shebang.length);
	}

	if (options.include_prefix) {
		prefix += instrumentationPrefix({
			name: options.tracer_name,
			nodejs: options.nodejs,
			maxInvocationsPerTick: options.maxInvocationsPerTick,
		});
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

function containsRange(start1, end1, start2, end2) {
	return contains(start1, end1, start2) && contains(start1, end1, end2);
}

/**
 * returns all functions containing the given line/column, in order of
 * appearance in the file
 */
var findContainingFunctions = function (functions, line, column) {
	/** comparator for functions, sorts by their starting position */
	var compareFunctionsByPosition = function (a, b) {
		return comparePositions(a.start, b.start);
	};

	var funcs = [];
	for (var i in functions) {
		var startsBefore = comparePositions(functions[i].start, { line: line, column: column }) <= 0;
		var endsAfter    = comparePositions(functions[i].end,   { line: line, column: column }) >= 0;
		if (startsBefore && endsAfter) {
			funcs.push(functions[i]);
		}
	}

	// sort functions by appearance (i.e. by nesting level)
	funcs.sort(compareFunctionsByPosition);

	return funcs;
};




var makeId = function (type, path, loc) {
	return path + '-'
	     + type + '-'
	     + loc.start.line + '-'
	     + loc.start.column + '-'
	     + loc.end.line + '-'
	     + loc.end.column;
};

// uses the surrounding code to generate a reasonable name for a function
var concoctFunctionName = function (node) {
	var name = undefined;

	if (node.type === 'FunctionDeclaration') {
		// function xxx() { }
		//  -> "xxx"
		name = node.id.name;
	} else if (node.type === 'FunctionExpression') {
		if (node.id) {
			// (function xxx() { })
			//  -> "xxx"
			name = node.id.name;
		} else if (node.parent.type === 'VariableDeclarator') {
			// var xxx = function () { }
			//  -> "xxx"
			name = node.parent.id.name;
		} else if (node.parent.type === 'AssignmentExpression') {
			var left = node.parent.left;
			if (left.type === 'MemberExpression' && !left.computed) {
				if (left.object.type === 'MemberExpression' && !left.object.computed) {
					if (left.object.property.type === 'Identifier' && left.object.property.name === 'prototype') {
						// yyy.prototype.xxx = function () { }
						//  -> "yyy.xxx"
						name = left.object.object.name + '.' + left.property.name;
					}
				}
			}
		} else if (node.parent.type === 'CallExpression') {
			// look, I know this is a regexp, I'm just sick of parsing ASTs
			if (/\.on$/.test(node.parent.callee.source())) {
				var args = node.parent.arguments;
				if (args[0].type === 'Literal' && typeof args[0].value === 'string') {
					// .on('event', function () { })
					//  -> "('event' handler)"
					name = "('" + args[0].value + "' handler)";
				}
			} else if (node.parent.callee.type === 'Identifier') {
				if (['setTimeout', 'setInterval'].indexOf(node.parent.callee.name) !== -1) {
					// setTimeout(function () { }, xxx)
					// setInterval(function () { }, xxx)
					//  -> "timer handler"
					name = 'timer handler';
					if (node.parent.arguments[1] && node.parent.arguments[1].type === 'Literal' && typeof node.parent.arguments[1].value === 'number') {
						// setTimeout(function () { }, 100)
						// setInterval(function () { }, 1500)
						//  -> "timer handler (100ms)"
						//  -> "timer handler (1.5s)"
						if (node.parent.arguments[1].value < 1000) {
							name += ' (' + node.parent.arguments[1].value + 'ms)';
						} else {
							name += ' (' + (node.parent.arguments[1].value / 1000) + 's)';
						}
					}
					name = '(' + name + ')';
				} else {
					// xxx(function () { })
					//  -> "('xxx' callback)"
					name = "('" + node.parent.callee.source() + "' callback)";
				}
			} else if (node.parent.callee.type === 'MemberExpression') {
				if (node.parent.callee.property.type === 'Identifier') {
					// xxx.yyy(..., function () { }, ...)
					//  -> "('yyy' callback)"
					name = "('" + node.parent.callee.property.name + "' callback)";
				}
			}
		} else if (node.parent.type === 'Property') {
			// { xxx: function () { } }
			//  -> "xxx"
			name = node.parent.key.name || node.parent.key.value;
			if (name !== undefined) {
				if (node.parent.parent.type === 'ObjectExpression') {
					var obj = node.parent.parent;
					if (obj.parent.type === 'VariableDeclarator') {
						// var yyy = { xxx: function () { } }
						//  -> "yyy.xxx"
						name = obj.parent.id.name + '.' + name;
					} else if(obj.parent.type === 'AssignmentExpression') {
						var left = obj.parent.left;
						if (left.type === 'MemberExpression' && !left.computed) {
							if (left.object.type === 'Identifier' && left.property.name === 'prototype') {
								// yyy.prototype = { xxx: function () { } }
								//  -> "yyy.xxx"
								name = left.object.name + '.' + name;
							}
						}
					}
				}
			}
		}
	}

	return name;
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
		trace_function_creation: true,
		trace_function_calls: true,
		trace_branches: false,
		trace_switches: false,
		trace_loops: false,
		source_map: false,
	};
	options = mergeInto(options, defaultOptions);

	var processed = content;
	var functionSources = {};

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
		if (node.type == "Identifier"){
			return node;
		}
		if (node.type == "MemberExpression"){
			return getIdentifierFromMemberExpression(node.object)
		}
		return null;
	}

	/* 
	Returns 0 for local and -1 for non variables (literals, integers etc)
	Returns 1 for global
	*/
	var IsLocalVariable = function (node){
		if (node.type == "ConditionalExpression"){
			return (IsLocalVariable(node.consequent) || IsLocalVariable(node.alternate))
		}

		identifier = getIdentifierFromMemberExpression(node);
		if (!identifier || node.type == "ObjectExpression" || node.type == "Literal" || node.type == "NewExpression"){
			return 0;
		}
	    parent = identifier.parent;
	    while (parent != undefined && parent.parent != undefined){
	        if (parent.type == "FunctionDeclaration" || parent.type == "FunctionExpression"){
	        	functionArguments = getArgs(parent);
	        	if (parent.localVariables == undefined) parent.localVariables = []
	            if (parent.localVariables.includes(identifier.name) || functionArguments.includes(identifier.name)){
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
	            parent.globalVariables = []
	            alias = {}; parent.globalVariables.push(alias);
	        }
	        if (node.source() in parent.globalVariables[0] || parent.globalVariables.includes(node.source()) || Object.values(parent.globalVariables[0]).includes(node.source()) ) return;
	        if (otherArgs != undefined){
        		if (node.id) parent.globalVariables[0][node.id.name] = otherArgs.name;
        		else parent.globalVariables[0][node.name] = otherArgs.name;
	        } else {
	        	parent.globalVariables.push(node.source());
	        }
	        try { localIndex = parent.localVariables.indexOf(node.source());
    		if (localIndex > -1) parent.localVariables.splice(localIndex, 1);
    		} catch(err) {}
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
	var extractTracePoints = function (content, path) {
		var nodes = [];

		try {
			falafel({
				source: content,
				loc: true
			}, function (node) {

				// save each function's original source code
				if (node.type === 'FunctionExpression' || node.type === 'FunctionDeclaration') {
					functionSources[makeId('function', options.path, node.loc)] = node.source();
				}

				if (node.type === 'FunctionExpression' || node.type === 'FunctionDeclaration') {
					var params = [];
					node.params.forEach(function (param) {
						params.push({ name: param.name, start: param.loc.start, end: param.loc.end });
					});

					nodes.push({
						path: path,
						start: node.loc.start,
						end: node.loc.end,
						id: makeId("function", path, node.loc),
						type: "function",
						name: concoctFunctionName(node),
						params: params,
						localvars: node.localVariables,
						globalvars: node.globalVariables
					});

				} else if (node.type === 'CallExpression') {
					var nameLoc = (node.callee.type === 'MemberExpression') ? node.callee.property.loc : node.callee.loc;

					nodes.push({
						path: path,
						start: node.loc.start,
						end: node.loc.end,
						id: makeId("callsite", path, node.loc),
						type: "callsite",
						name: node.callee.source(),
						nameStart: nameLoc.start,
						nameEnd: nameLoc.end
					});

				} else if (node.type === 'Program') {
					nodes.push({
						path: path,
						start: node.loc.start,
						end: node.loc.end,
						id: makeId("toplevel", path, node.loc),
						type: "toplevel",
						name: '(' + basename(path) + ' toplevel)',
					});

				} else if (node.type === 'VariableDeclaration' || node.type === 'VariableDeclarator') {
					if (node.type == "VariableDeclarator"){
						if (node.init) {
							if (IsLocalVariable(node.init) == 0) {
								addLocalVariable(node);
							} else {
								// removeLocalVariable(node);
								addGlobalVariable(node,node.init);
							}
						} else {
							addLocalVariable(node);
						}
				    }
				// Handles any global variable being assigned any value
				// or a local variable becoming an alias of a global variable
				} else if (node.type == "AssignmentExpression"){
					if (IsLocalVariable(node.left) > 0){
						//a global variable is being updated, and hence needs to be tracked
						addGlobalVariable(node.left);
					} else if (IsLocalVariable(node.right) > 0){
						//the left node is local, however the right node is global, 
						//therefore left becomes an alias to a global
						// therefore no longer local
						// also, now track the global variable being aliased
						// console.log("ENtered condition where left: " + node.left.source() + "is local but right is global: " + node.right.source());
						removeLocalVariable(node.left);
						addGlobalVariable(node.left, node.right);
					} else {
						addLocalVariable(node.left);
					}
				} else if (node.type === 'IfStatement') {
					var handleBranch = function (node) {
						nodes.push({
							path: path,
							start: node.loc.start,
							end: node.loc.end,
							id: makeId("branch", path, node.loc),
							type: "branch",
						});
					};

					if (node.consequent) {
						handleBranch(node.consequent);
					}

					// we will have already visited a nested IfStatement since falafel visits children first
					if (node.alternate && node.alternate.type !== 'IfStatement') {
						handleBranch(node.alternate);
					}
				}
			}).toString();

		} catch (e) {
			console.error("exception during parsing", path, e.stack, " CONTENT: ",content);
			return;
		}

		return JSON.stringify({ nodes: nodes });
	};

	var prologue = "";
	prologue += template(/*tracer-stub.js{*/fs.readFileSync(__dirname + '/lib/tracer-stub.js', 'utf8')/*}tracer-stub.js*/, { name: options.tracer_name });
	if (options.source_map) prologue += "/*mapshere*/";
	prologue += options.tracer_name + '.add(' + JSON.stringify(options.path) + ', ' + extractTracePoints(content, options.path) + ');\n\n';

	try {
		var fala, update, sourceNodes;

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
		var escapeRegExp = function(str) {
		  return str.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|\']/g, "\\$&");
		}

		var modifyParentExpression = false;
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
				var info = { nodeId: makeId("toplevel", options.path, node.loc) };
				var arg = JSON.stringify(info);

				update(node,
					options.prefix,
					prologue,
					options.tracer_name, '.traceFileEntry(' + arg + ');\n',
					'try {\n', sourceNodes(node), '\n} finally {\n',
					options.tracer_name, '.traceFileExit(' + arg + ');\n',
					'}');
			}

			if (node.type === 'FunctionExpression' || node.type === 'FunctionDeclaration') {
				var attrs = { nodeId: makeId('function', options.path, node.loc), localVars: node.localVariables, globalVariables: node.globalVariables };

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
					update(node.body, '{ ', traceBegin, ' try { ', sourceNodes(node.body), '\n } catch (e) { ', traceError, ' } finally { ', traceEnd, ' } }');
				}

				if (node.type === 'FunctionExpression' && options.trace_function_creation) {
					if (node.parent.type !== 'Property' || node.parent.kind === 'init') {
						update(node, options.tracer_name, '.traceFunCreate(', sourceNodes(node), ', ', JSON.stringify(functionSources[attrs.nodeId]), ')');
					}
				}
			} else if (node.type === 'CallExpression') {
				// if (options.trace_function_calls) {
				// 	var id = makeId("callsite", loc.path, loc);

				// 	if (node.callee.source() !== "require") {
				// 		if (node.callee.type === 'MemberExpression') {
				// 			if (node.callee.computed) {
				// 				update(node.callee, ' ', options.tracer_name, '.traceFunCall({ this: ', sourceNodes(node.callee.object), ', property: ', sourceNodes(node.callee.property), ', nodeId: ', JSON.stringify(id), ', vars: {} })');
				// 			} else {
				// 				update(node.callee, ' ', options.tracer_name, '.traceFunCall({ this: ', sourceNodes(node.callee.object), ', property: "', sourceNodes(node.callee.property), '", nodeId: ', JSON.stringify(id), ', vars: {} })');
				// 			}
				// 		} else {
				// 			update(node.callee, ' ', options.tracer_name, '.traceFunCall({ func: ', sourceNodes(node.callee), ', nodeId: ', JSON.stringify(id), ', vars: {} })');
				// 		}
				// 	}
				// }
			} else if (node.type == "ExpressionStatement"){
				if (modifyParentExpression){
					update(node, ' \n try { ', sourceNodes(node), ' } catch(err){ console.log("error while updating global tracking" + err);} \n');
				}
				modifyParentExpression = false;
			} else if (/Statement$/.test(node.type)) {
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
			} else if (node.type === 'VariableDeclaration' || node.type === 'VariableDeclarator') {
				if (node.type == "VariableDeclarator"){
					if (node.init) {
						if (IsLocalVariable(node.init) == 0) {
							addLocalVariable(node);
						} else {
							// removeLocalVariable(node);
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
					//a global variable is being updated, and hence needs to be tracked
					addGlobalVariable(node.left);
					console.log("source: " + node.right.source() + " type : " + node.right.type);
					update(node,node.left.source(),node.operator, options.tracer_name,'.setValue(',node.right.source(),',','\'',escapeRegExp(node.left.source()),'\'',',',node.left.source(),',',node.right.type')');
					// update(node, node.left.source(), node.operator, options.tracer_name, '.setValue(', node.right.source(),',',node.left,')');

				} else if (IsLocalVariable(node.right) > 0){
					//the left node is local, however the right node is global, 
					//therefore left becomes an alias to a global
					// therefore no longer local
					// also, now track the global variable being aliased
					// console.log("ENtered condition where left: " + node.left.source() + "is local but right is global: " + node.right.source());
					removeLocalVariable(node.left);
					addGlobalVariable(node.left, node.right);
				} else {
					addLocalVariable(node.left);
				}
			} else if (node.type === 'SwitchStatement') {
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
