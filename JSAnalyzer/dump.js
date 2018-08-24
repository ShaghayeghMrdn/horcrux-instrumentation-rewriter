       
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