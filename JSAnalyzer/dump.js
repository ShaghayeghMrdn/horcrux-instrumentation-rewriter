       
        /* Taken from index.js */

        var replaceAliasesWithActuals = function(node) {
            node.globalWrites = _replaceAliasesWithActuals(node, node.globalWrites, true);
            if (node.globalReads) console.log(sourceNodes(node.globalReads[0]));
            node.globalReads =  _replaceAliasesWithActuals(node, node.globalReads, false);
        }

        var _replaceAliasesWithActuals = function(node, source, nop) {
            if (source == undefined) return;
            // console.log(source.map(function(key){return key.source()}));
            var indicesMatched = [];
            var arrayWithSources = [];
            source.forEach(function(entry,it){
                var isExpression = false;
                var isMemberAndComputed = false;
                if (entry.type == "CallExpression") isExpression = true;
                if (entry.type == "MemberExpression" && (entry.property.type == "Identifier" && entry.computed) ) isMemberAndComputed = true;
                var against = node;
                while (against.parent != undefined ) {
                    if (against.globalAlias){
                        if (isMemberAndComputed) entry = util.getBaseIdentifierFromMemberExpression(entry);
                        var identifier = util.getIdentifierFromGenericExpression(entry) || entry;
                        var remaining = entry.source().replace(identifier.source(),"");
                        if (identifier.source() in against.globalAlias){
                            indicesMatched.push(it);
                            if (remaining == ""){
                                arrayWithSources.push(against.globalAlias[identifier.source()]);
                                if (isExpression && nop) arrayWithSources.push("NOP");
                            }
                            else {
                                arrayWithSources.push(against.globalAlias[identifier.source()] + remaining);
                                if (isExpression && nop) arrayWithSources.push("NOP");
                            }
                        }
                    }
                    against = against.parent;
                }
            });
            source.forEach(function(entry, it){
                if (indicesMatched.indexOf(it) < 0){
                    if (entry.type == "MemberExpression" && (entry.property.type == "Identifier" && entry.computed) )
                        entry = util.getBaseIdentifierFromMemberExpression(entry);
                    arrayWithSources.push(entry.source());
                    if (entry.type == "CallExpression" && nop) arrayWithSources.push("NOP");
                }
            })
            return arrayWithSources;
        }

        var replaceAliasWithinAlias = function(node) {
            if (node.globalAlias == undefined) return;
            var indicesMatched = [];
            var sourceVersion = {};
            Object.entries(node.globalAlias).forEach(function(pair){
                var identifier = util.getIdentifierFromGenericExpression(pair[1]) || pair[1];
                var remaining =  pair[1].source().replace(identifier.source(),"");
                if (Object.keys(node.globalAlias).indexOf(identifier.source()) > -1 ){
                    indicesMatched.push(pair[0]);
                    if (remaining == "") {
                        sourceVersion[pair[0]] = node.globalAlias[identifier.source()].source();

                    }
                    else {
                        sourceVersion[pair[0]] = node.globalAlias[identifier.source()].source() + remaining;
                    }
                }
            });
            Object.keys(node.globalAlias).forEach(function(key) {
                if (indicesMatched.indexOf(key) < 0) {
                    sourceVersion[key] = node.globalAlias[key].source();
                }
            })
            return sourceVersion;
        }

        /* Replaces an alias variable with the actual variable*/
        var checkAndReplaceAlias = function(node) {
            var parent = node.parent;
            let alias = scope.isGlobalAlias(node, false); /* The second argument implies the globalALias no longer has values as node types because replaceAliasWithAlias was called */
            if (alias){
                var ident = util.getIdentifierFromGenericExpression(node) || node;
                var remaining = node.source().replace(ident.source(), "");
                if (remaining == "") {
                        update(node, alias);
                    } else {
                        update(node, alias, remaining);
                    }
            }
            // var ident = util.getIdentifierFromGenericExpression(node) || node;
            // var remaining = node.source().replace(ident.source(), "");
            // while (parent != undefined) {
            //  if (parent.type == "FunctionExpression" || parent.type == "FunctionDeclaration"){
            //      if (parent.globalAlias && Object.keys(parent.globalAlias).indexOf(ident.source()) > -1 ) {
            //          if (remaining == "") {
            //              update(node, parent.globalAlias[ident.source()]);
            //          } else {
            //              update(node, parent.globalAlias[ident.source()], remaining);
            //          }
            //      }
            //  }
            //  parent = parent.parent;
            // }
        }

        var buildArgs = function (args, check) {
            if (args) {
                var modifiedArgArray = [];
                var localCounter = 0;
                args.forEach(function(arg, it){
                    if (arg != "" && !arg.includes("NOP")) {
                        if (args[it + 1] != "NOP") {
                            modifiedArgArray.push("`" + util.escapeRegExp(arg) + "`");
                            if (check) modifiedArgArray.push("typeof " +  arg + "=='undefined'?null:" + arg );
                            else modifiedArgArray.push(arg);
                        } else {
                            modifiedArgArray.push("\"NOP" + localCounter++ + "\"");
                            modifiedArgArray.push("`" + util.escapeRegExp(arg) + "`");
                        }
                    }
                });

                return modifiedArgArray;
            }
        }

        var traceReturnValue = function(node) {
            var parent = node.parent;
            while (parent != undefined) {
                if ( parent.type == "FunctionDeclaration" || parent.type == "FunctionExpression" ) {
                    if (node.argument.type == "SequenceExpression") {
                        parent.returnValue = node.argument.expressions[node.argument.expressions.length - 1];
                    } else {
                        parent.returnValue = node.argument;
                    }
                    return;
                }
                parent = parent.parent;
            }
        }



        /* Taken from tracer.js */


    var buildCacheObject = function(obj){
        var acyclicObj = {};
        Object.keys(obj).forEach(function(nodeId){
            acyclicObj[nodeId] = {};
            Object.keys(obj[nodeId]).forEach(function(md){
                try {
                    acyclicObj[nodeId][md] = stringify(obj[nodeId][md]);
                } catch (err) {

                }

            });

            try { 
                localStorage.setItem(nodeId, JSON.stringify(acyclicObj[nodeId]));
            } catch (err) {
                // TODO wrong practice empty catch block
            }
        });

        return acyclicObj;
    }

    var stringifyMutation = function(mut) {
        var stringMut = {};

    }

    var extractCacheObject = function(){
        var cacheObject = {};

        Object.keys(localStorage).forEach(function(nodeId){ 
            try {
                var value = JSON.parse(localStorage.getItem(nodeId));
                cacheObject[nodeId] = {};
                Object.keys(value).forEach(function(md){
                    try {
                     cacheObject[nodeId][md] = parse(value[md]);
                    } catch (err) {}
                });
            } catch (err) {}
        });

        return cacheObject;
    }

    var isCyclic = function (obj) {
      var keys = [];
      var stack = [];
      var stackSet = new Set();
      var detected = false;

      function detect(obj, key) {
        if (typeof obj != 'object') { return; }

        if (stackSet.has(obj)) { // it's cyclic! Print the object and its locations.
          var oldindex = stack.indexOf(obj);
          var l1 = keys.join('.') + '.' + key;
          var l2 = keys.slice(0, oldindex + 1).join('.');
          // console.log('CIRCULAR: ' + l1 + ' = ' + l2 + ' = ' + obj);
          // console.log(obj);
          detected = true;
          return;
        }

        keys.push(key);
        stack.push(obj);
        stackSet.add(obj);
        for (var k in obj) { //dive on the object's children
          if (obj.hasOwnProperty(k)) { detect(obj[k], k); }
        }

        keys.pop();
        stack.pop();
        stackSet.delete(obj);
        return;
      }

      detect(obj, 'obj');
      return detected;
    }

        this.compareAndCache = function(nodeId, params, globalReads, info) {
        customLocalStorage[nodeId] = {};
        customLocalStorage[nodeId]["writes"] = {};
        return false;
        try {
            if (!(nodeId in invocations))
                invocations[nodeId] = 0;
            invocations[nodeId]++;
            functions.add(nodeId);
            var cacheObjectReads = this.parse.call(this, localStorage.getItem(nodeId + "-reads") || null);
            var gthis = this;
            if (cacheObjectReads){
                Object.keys(cacheObjectReads).forEach(function(read){
                    if (read == "params") {
                        try {
                            if (!(gthis.stringify.call(gthis, params) == cacheObjectReads[read])) {
                                // console.log("arguments match failed for " + nodeId + " "  + JSON.stringify(params)  + cacheObjectReads[read] );
                                return false;
                            } 
                        } catch (e) {
                            // console.log("[WARNING] stringifying circular object: " + nodeId);
                            return false;
                        }
                    }
                    else if (!(gthis.stringify.call(gthis,eval(read)) == gthis.stringify.call(gthis,cacheObjectReads[read]))) {
                        // console.log("cache exists but didn't match for function: " + nodeId + " different read:" + JSON.stringify(arguments));
                        return false;
                    }

                }); 
                var cacheObjectWrites = this.parse.call(this,localStorage.getItem(nodeId + "-writes") || null);
                var returnValue = true;
                // console.log("Cache hit for function: " + nodeId);
                if (!(nodeId in cacheStats.cacheHit))
                    cacheStats.cacheHit[nodeId] = 0;

                cacheStats.cacheHit[nodeId]++;
                if (cacheObjectWrites) {
                    Object.keys(cacheObjectWrites).forEach(function(write){
                        if (!write.includes("returnValue")) eval(write + "= " + gthis.stringify.call(gthis,cacheObjectWrites[write]));
                        else returnValue = cacheObjectWrites[write];
                    });
                }
                return false;
            }

            // If cache doesn't exist, then update cache, however if it does, no version control:
            // console.log("Cache doesn't yet exist for : " + nodeId);
            var serializedObject = {};
            if (globalReads.length) {
                globalReads.forEach(function(read, it){
                    if (it%2==0 && !isNative(globalReads[it+1]))
                        serializedObject[read] = globalReads[it+1]; 
                });
            }

            serializedObject["params"] = this.stringify.call(this,params);
            // console.log("setting read cache value for " + nodeId + " " + this.stringify(serializedObject));
            localStorage.setItem(nodeId + "-reads", this.stringify.call(this,serializedObject));
            return false;
        } catch (e) { 
            // console.log("[WARNING][COMPARECACHE] warning raised while comparing the cache" + e + e.stack); 
            return false;
        }
    }

        // var buildCacheObject = function(nodeId, globalWrites, returnValue) {
    //     // console.log(local"building cache for " + info.nodeId)
    //     try {
    //         // console.log("the return value is: " + returnValue);
    //         var serializedObject = {};
    //         if (returnValue)  {
    //             serializedObject["returnValue"] = returnValue;
    //         }
    //         if (globalWrites.length) {
    //             globalWrites.forEach(function(write, it){
    //                 if (it%2==0 && !isNative(globalWrites[it+1]))
    //                     serializedObject[write] = globalWrites[it+1]; 
    //                 // console.log(info.nodeId + "the cache object looks like: " + JSON.stringify(serializedObject));
    //             });
    //         }
    //         // console.log("Cache looks like "  + JSON.stringify(serializedObject));
    //         return serializedObject;
    //     } catch (e) {
    //         // console.log("[WARNING] Building cache object "  + e + e.stack);
    //         return {};
    //     }
    // }

    this.dumpCache = function(nodeId, globalWrites, returnValue) {
        return;
        try {
            var _cacheValue = buildCacheObject(nodeId, globalWrites, returnValue);
            var cacheValue =  this.stringify.call(this, _cacheValue);
            // console.log("Dupming cache for " + nodeId + " with length " + cacheValue.length);
            localStorage.setItem(nodeId + "-writes", cacheValue);
        } catch (dumpErr) {
            // do nothing as of now. 
        }
    }



        toJSON = function(node) {
        node = node || this;
        var obj = {
        nodeType: node.nodeType
        };
        if (node.tagName) {
        obj.tagName = node.tagName.toLowerCase();
        } else
        if (node.nodeName) {
        obj.nodeName = node.nodeName;
        }
        if (node.nodeValue) {
        obj.nodeValue = node.nodeValue;
        }
        var attrs = node.attributes;
        if (attrs) {
        var length = attrs.length;
        var arr = obj.attributes = new Array(length);
        for (var i = 0; i < length; i++) {
          attr = attrs[i];
          arr[i] = [attr.nodeName, attr.nodeValue];
        }
        }
        var childNodes = node.childNodes;
        if (childNodes) {
        length = childNodes.length;
        arr = obj.childNodes = new Array(length);
        for (i = 0; i < length; i++) {
          arr[i] = toJSON(childNodes[i]);
        }
        }
        return obj;
    }

    toDOM = function(obj) {
        if (typeof obj == 'string') {
        obj = JSON.parse(obj);
        }
        var node, nodeType = obj.nodeType;
        switch (nodeType) {
        case 1: 
          node = document.createElement(obj.tagName);
          var attributes = obj.attributes || [];
          for (var i = 0, len = attributes.length; i < len; i++) {
            var attr = attributes[i];
            node.setAttribute(attr[0], attr[1]);
          }
          break;
        case 3: 
          node = document.createTextNode(obj.nodeValue);
          break;
        case 8: 
          node = document.createComment(obj.nodeValue);
          break;
        case 9: 
          node = document.implementation.createDocument();
          break;
        case 10: 
          node = document.implementation.createDocumentType(obj.nodeName);
          break;
        case 11: 
          node = document.createDocumentFragment();
          break;
        default:
          return node;
        }
        if (nodeType == 1 || nodeType == 11) {
        var childNodes = obj.childNodes || [];
        for (i = 0, len = childNodes.length; i < len; i++) {
          node.appendChild(toDOM(childNodes[i]));
        }
        }
        return node;
    }

    if (typeof JSON.decycle !== "function") {
        JSON.decycle = function decycle(object, replacer) {
            "use strict";


            var objects = new WeakMap();     /* object to path mappings*/

            return (function derez(value, path) {


                var old_path;   
                var nu;         

    // If a replacer function was provided, then call it to get a replacement value.

                if (replacer !== undefined) {
                    value = replacer(value);
                }

                if (
                    typeof value === "object" && value !== null &&
                    !(value instanceof Boolean) &&
                    !(value instanceof Date) &&
                    !(value instanceof Number) &&
                    !(value instanceof RegExp) &&
                    !(value instanceof String)
                ) {

    // If the value is an object or array, look to see if we have already
    // encountered it. If so, return a {"$ref":PATH} object. This uses an
    // ES6 WeakMap.

                    old_path = objects.get(value);
                    if (old_path !== undefined) {
                        return {$ref: old_path};
                    }

    // Otherwise, accumulate the unique value and its path.

                    objects.set(value, path);

    // If it is an array, replicate the array.

                    if (Array.isArray(value)) {
                        nu = [];
                        value.forEach(function (element, i) {
                            nu[i] = derez(element, path + "[" + i + "]");
                        });
                    } else {

    // If it is an object, replicate the object.

                        nu = {};
                        Object.keys(value).forEach(function (name) {
                            nu[name] = derez(
                                value[name],
                                path + "[" + JSON.stringify(name) + "]"
                            );
                        });
                    }
                    return nu;
                }
                return value;
            }(object, "$"));
        };
    }


    if (typeof JSON.retrocycle !== "function") {
        JSON.retrocycle = function retrocycle($) {
            "use strict";

            var px = /^\$(?:\[(?:\d+|"(?:[^\\"\u0000-\u001f]|\\([\\"\/bfnrt]|u[0-9a-zA-Z]{4}))*")\])*$/;

            (function rez(value) {


                if (value && typeof value === "object") {
                    if (Array.isArray(value)) {
                        value.forEach(function (element, i) {
                            if (typeof element === "object" && element !== null) {
                                var path = element.$ref;
                                if (typeof path === "string" && px.test(path)) {
                                    value[i] = eval(path);
                                } else {
                                    rez(element);
                                }
                            }
                        });
                    } else {
                        Object.keys(value).forEach(function (name) {
                            var item = value[name];
                            if (typeof item === "object" && item !== null) {
                                var path = item.$ref;
                                if (typeof path === "string" && px.test(path)) {
                                    value[name] = eval(path);
                                } else {
                                    rez(item);
                                }
                            }
                        });
                    }
                }
            }($));
            return $;
        };
    }




    /* The following code is from util.js*/

    var getBaseIdentifierFromMemberExpression = function (node) {
        if (node.type != "MemberExpression")
            return node;
        getBaseIdentifierFromMemberExpression(node.)
        var r = getIdentifierFromGenericExpression(node);
        if (!r) return node;
        var parent = r.parent;
        while (!parent.computed) {
            r = parent;
            parent = parent.parent;
        }
        return r;
    }


    /* THE FOLLOWING CODE IS FROM SIGNATUREJS*/

    var handleBinaryandLogical = function(node) {
    if (node == undefined || node.type == "AssignmentExpression")
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

var handleAssignmentExpressions = function(node){
    var reads = [];
    if (node.type != "AssignmentExpression")
        reads.push(node);
    else 
        reads = reads.concat(handleAssignmentExpressions(node.right))
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