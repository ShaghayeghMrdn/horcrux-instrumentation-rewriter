

/*
 * Copyright (c) 2012 Massachusetts Institute of Technology, Adobe Systems
 * Incorporated, and other contributors. All rights reserved.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a
 * copy of this software and associated documentation files (the "Software"),
 * to deal in the Software without restriction, including without limitation
 * the rights to use, copy, modify, merge, publish, distribute, sublicense,
 * and/or sell copies of the Software, and to permit persons to whom the
 * Software is furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
 * FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
 * DEALINGS IN THE SOFTWARE.
 *
 */

/*
The source of source-map is included below on the line beginning with "var sourceMap",
and its license is as follows:

Copyright (c) 2009-2011, Mozilla Foundation and contributors
All rights reserved.

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are met:

* Redistributions of source code must retain the above copyright notice, this
  list of conditions and the following disclaimer.

* Redistributions in binary form must reproduce the above copyright notice,
  this list of conditions and the following disclaimer in the documentation
  and/or other materials provided with the distribution.

* Neither the names of the Mozilla Foundation nor the names of project
  contributors may be used to endorse or promote products derived from this
  software without specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE
FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
DAMAGES (INCLUDING, BUT NOT LIMITED T, PROCUREMENT OF SUBSTITUTE GOODS OR
SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER
CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY,
OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
*/

if (typeof {name} === 'undefined') {
{name} = new (function () {
    var e2eTesting = true;
    var functions = new Set();
    var invocations = {};
    var cacheStats = {};
    var nativeObjectsStore = {};
    var customLocalStorage = {}; // Use this in place of the localstorage API for faster access. 
    cacheStats.cacheHit = {};
    var counter = 0;
    var currentMutationContext = null;
    var shadowStack = [];
    var _shadowStackHead;
    var objectIdCounter = 1;
    var mutations = new Map();
    var functionTimerS = {};
    var functionTimerE = {};
    var ObjectTree = {};
    var proxyToThis = new WeakMap();
    var methodToProxy = new WeakMap();
    var proxyToMethod = new WeakMap();
    var ObjectToId = new WeakMap();
    var idToObject = new Map();
    var processedSignature;
    var objectToPath; 
    var pageLoaded = false;
    var callGraph = {};

    /* Initialize the object tree with window as the root object*/
    ObjectToId.set(window,0);
    // console.log(ObjectToId);
    ObjectTree[0] = {};


    // window.addEventListener("load", function(){

    //     //Builds the cache object to be dumped in local persistent storage
    //     // buildCacheObject(customLocalStorage);
    //     localStorage.setItem("executionCount",1);
    //     observer.disconnect();
    // });

    // var targetNode = document;
    // var config = {attributes: true, childList: true, characterData: true, subtree: true, attributeOldValue: true, characterDataOldValue: true};
    // var callback = function(mutationsList) {
    //     if (currentMutationContext) {
    //         if (!mutations.get(currentMutationContext))
    //             mutations.set(currentMutationContext, []);
    //         var lMutations = mutations.get(currentMutationContext);
    //         lMutations.push.apply(lMutations, mutationsList);

    //         currentMutationContext = null;
    //     }
    // };

    window.addEventListener("load", function(){
        console.log("PROXY STATS");
        console.log(window.proxyReadCount, window.proxyWriteCount);
        pageLoaded = true;
        window.{proxyName} = window;
        
        // Process the signature to construct meaningful paths
        var sigProcessor = new SignatureProcessor(customLocalStorage, ObjectTree, idToObject, callGraph);
        sigProcessor.process();
        sigProcessor.postProcess();
        sigProcessor.signaturePropogate();
        /*
        Setting the global variables with class fields
        */
        processedSignature = sigProcessor.processedSig;
        objectToPath = sigProcessor.objectToPath;
    })

    // var observer = new MutationObserver(callback);
    // observer.observe(document, config);

    /* Proxy object handler */
    window.proxyReadCount =0; window.proxyWriteCount = 0;

    /*Re write the bind method because the default bind might be overridden. */

    // Function.prototype._bind = function(thisArg){
    //     return Function.prototype.bind.apply(this, thisArg);
    // }

    // Function.prototype._call = function(thisArg, ...args){
    //     return Function.prototype.call.apply(thisArg, _thisArg, args);
    // }
    // var origCall = Function.prototype.call;
    // Function.prototype.call = function(thisArg, ...args) {
    //     var vThisArg;
    //     if (thisArg && thisArg.__isProxy)
    //         vThisArg = proxyToMethod.get(thisArg)
    //     else vThisArg = thisArg;

    //     return origCall.apply(this, [vThisArg, ...args]);
    // }

    // Function.prototype.apply = function(thisArg, args) {
    //     var vThisArg;
    //     if (thisArg && thisArg.__isProxy)
    //         vThisArg = proxyToMethod.get(thisArg)
    //     else vThisArg = thisArg;

    //     this.apply(vThisArg, args);
    // }

    var appendObjectTree = function(rootId, key, childId){
        var _edge = ObjectTree[rootId];
        if (typeof key == "symbol")
            var ekey = "e_" + key.toString();
        else var ekey = "e_" + key;
        if (_edge) {
            if (!_edge[ekey]) {
                _edge[ekey] = [];
                _edge[ekey].push(childId);
            } else _edge[ekey].push(childId);
        }
        else {
            ObjectTree[rootId]  = {};
            var edge = ObjectTree[rootId];
            edge[ekey] = [];
            edge[ekey].push(childId);
        }
    }

    var loggerFunction = function(target, key, value, logType){
        if (key == "__isProxy" || key == "top" || key == "parent" || document.readyState == "complete") return;
        var nodeId = _shadowStackHead ? _shadowStackHead : null;
        if (!nodeId) return;
        var rootId;
        var _rootId = ObjectToId.get(target);
        if (_rootId != null)
            rootId = _rootId;
        else {
            rootId = objectIdCounter;
            idToObject.set(objectIdCounter, target);
            ObjectToId.set(target, objectIdCounter++);
        }
        if (value instanceof Object) {
            var _id = ObjectToId.get(value);
            if (_id != null)
                var childId = _id;
            else {
                var childId = objectIdCounter;
                idToObject.set(objectIdCounter, value);
                ObjectToId.set(value, objectIdCounter++);
            }
            // Only add to tree if the value is type object
            appendObjectTree(rootId, key, childId);
        } else {
            if (typeof value == "symbol")
                var childId = 'p-'  + value.toString();
            else var childId = 'p-' + value;
        }

        if (logType == "reads")
            customLocalStorage[nodeId]["reads"].push([rootId, key, childId]);
        else
            customLocalStorage[nodeId]["writes"].push([rootId, key, childId]);
    }

    var _handleSymbolKey = function(target, key){
        if (!Reflect.get(target, key)){
            switch (key.toString()){
                case 'Symbol(Symbol.toPrimitive)':
                    if (+target) return +target;
                    if (''+target) return ''+target;
            }
        }
    }

    var handleNonConfigurableProperty = function(target, key){
        var method = Reflect.get(target,key);
        /*if (typeof target[key] == "function"){
            _thisArg = target;
            method.call = method._call;
            return method;
        } else*/ return method;
    } 

    var handleMetaProperties = function(target, key){
        switch(key){
            case 'apply' :
                return Reflect.get(target, key);
                break;
            case 'call':
                return Reflect.get(target, key);
                break;
            case 'bind':
                return Reflect.get(target, key);
                break;            
        }
    }

    var isDOMInheritedProperty = function(method){
        return (method instanceof Element || method instanceof HTMLCollection)
    }

    var outOfScopeProperties = ["location", "body", "Promise", "top", "parent"];

    var handler = {
      get(target, key, receiver) {
        var method = Reflect.get(target,key);
        loggerFunction(target, key, method, "reads");
        if (key == "__isProxy") return true;
        if (method && (typeof method === 'object' || typeof method=== "function") && !outOfScopeProperties.includes(key) && !isDOMInheritedProperty(target[key]) && !method.__isProxy) {
          var desc = Object.getOwnPropertyDescriptor(target, key);
          if (desc && ! desc.configurable && !desc.writable) return handleNonConfigurableProperty(target, key);
          window.proxyReadCount++;
          // if (window.proxyReadCount % 1000000 == 0)
          //   alert("window.Proxyreadcount is " + window.proxyReadCount);
          // if (typeof method == "function") {
          //   var _method = method._bind(target);
          //   Object.setPrototypeOf(_method, method);
          //   if (!isNative(method))
          //       Object.assign(_method, method);
          //   return new Proxy(_method,);
          // }
          if (key == "apply" || key == "call" || key == "bind") return method;
          // console.log("Calling get of " + key + " and setting this to ");
          // console.log(target);
          var _proxyMethod = methodToProxy.get(method);
          if (_proxyMethod) return _proxyMethod;
          var proxyMethod = new Proxy(method, handler);
          methodToProxy.set(method, proxyMethod);
          proxyToThis.set(method, target);
          proxyToMethod.set(proxyMethod, method);
          return proxyMethod;
        } else {
          return method;
        }
      },
      set (target, key, value, receiver) {
        loggerFunction(target, key, value,"writes");
        window.proxyWriteCount++;
        return Reflect.set(target, key, value);
      },
      apply (target, thisArg, args) {
            /*
                If no thisArg, call it in the context of window ( this happens by default )
                If the thisArg is a proxy object however it has no corresponding target method, call apply on the proxy object itself.
                If the thisArg is not a proxy object, call the method on the thisArg itself. 
            */
            if (!thisArg) return Reflect.apply(target, window, args);
            else if (!thisArg.__isProxy) return Reflect.apply(target, thisArg, args);
            // else if (proxyToMethod.get(thisArg) == null) {
            //     //throw "No method found for proxy";
            // }
            return Reflect.apply(target, proxyToMethod.get(thisArg), args);
      },
      construct (target, args) {
          // return new target(...args);
          return Reflect.construct(target, args);
      }
    }

    var {proxy, revoke} = Proxy.revocable(window, handler);
    window.{proxyName} = proxy;
    // window.{proxyName} = window;
    proxyToMethod.set(proxy, window);


    this.getShadowStack = function(clear){
        if (clear)
            _shadowStackHead = null;
        return shadowStack;
    }

    this.getCallGraph = function() {
        return callGraph;
    }

    this.getMutations = function() {
        return mutations;
    }
    
    this.setMutationContext = function(command, nodeId) {
        currentMutationContext = nodeId;
    }

	this.setGlobal = function (gthis) {
		globalThis = gthis;
	}

    this.getFunctions = function () {
        return functions;
    }

    this.getInvocations = function() {
        return invocations;
    }

    this.getCacheStats = function () {
        return cacheStats;
    }

    this.getCustomCache = function() {
        return customLocalStorage;
    }

    this.getProcessedSignature = function() {
        return processedSignature;
    }

    this.setCustomCache = function(customCache) {
        this.customLocalStorage = customCache;
    }

    this.getObjectTree = function(){
        return ObjectTree;
    }

    this.getObjectToPath = function() {
        return objectToPath;
    }

    this.getObjectToId = function(){
        return ObjectToId;
    }

    var accumulateCache = function(nodeId) {
        var aggrCache = {};
        var lCallees = calleeMap[nodeId];

        var traverseChildren = function(nodeId) {
            var lCallees = calleeMap[nodeId];
            if (lCallees) {
                lCallees.forEach(function(callee){
                    
                });
            }
        }
    }

    this.logWrite = function(functionIdentifier, rhs, variableName, listOfProperties ){
        var key = variableName;
        if (listOfProperties.length > 0)
            key = _patchLogString(variableName, listOfProperties);
        customLocalStorage[functionIdentifier]["writes"][key] = rhs;
        return rhs;
    }

    var _patchLogString = function(input, varArray){
        var count = 0;
        var output = input.replace(/(\[).(\])/g, function(match, g1, g2, offset, string){
            var replaceString = varArray[count]
            if (typeof varArray[count] == "symbol")
                replaceString = varArray[count].toString();
            count++;
            return g1 + replaceString + g2;
        });
        return output
    }

    this.logRead = function(functionIdentifier, readArray, listOfProperties){
        var key = readArray[0]
        if (listOfProperties.length > 0)
            key = _patchLogString(readArray[0],listOfProperties)
        customLocalStorage[functionIdentifier]["reads"][key] = readArray[1];
        return readArray[1];
    }

    this.logReturnValue = function(functionIdentifier, returnValue, proxyReturnValue) {
        customLocalStorage[functionIdentifier]["returnValue"] = returnValue;
        return returnValue;
    }

    var logNonProxyParams = function(nodeId,params){
        for(var i in params) {
            try {
                if (params[i] && !params[i].__isProxy)
                    customLocalStorage[nodeId]["arguments"]["before"][i] = params[i];
            } catch (e) {
                customLocalStorage[nodeId]["arguments"]["before"][i] = params[i];
            }
        }
    }


    this.cacheAndReplay = function(nodeId, params, info){
        if (_shadowStackHead)
            callGraph[_shadowStackHead].push(nodeId)
        if (!callGraph[nodeId])
            callGraph[nodeId] = [];

        shadowStack.push(nodeId);
        _shadowStackHead = nodeId;
        if (!customLocalStorage[nodeId]) {
            customLocalStorage[nodeId] = {};
            customLocalStorage[nodeId]["writes"] = [];
            customLocalStorage[nodeId]["reads"] = [];
            if (params.length != 0) {
                customLocalStorage[nodeId]["arguments"] = {};
                customLocalStorage[nodeId]["arguments"]["before"] = {};
                customLocalStorage[nodeId]["arguments"]["after"] = {};
                logNonProxyParams(nodeId, params);
            }
        } else {
            return false;
            // console.log("Cache hit for function " + nodeId);
            var returnValue = customLocalStorage[nodeId]["returnValue"] ? customLocalStorage[nodeId]["returnValue"] : true;
            if (params && customLocalStorage[nodeId]["arguments"]){
                Object.keys(params).forEach(function(ind){
                    params[ind] = customLocalStorage[nodeId]["arguments"]["after"][ind];
                });
            }

            Object.keys(customLocalStorage[nodeId]["writes"]).forEach(function(write){
                var evalString = write + " = " + stringify(customLocalStorage[nodeId][write])
                eval(evalString);
            });

            // return returnValue;
        }
        // if (globalReads.length) {
        //     globalReads.forEach(function(read, it){
        //         if (it%2==0)
        //             customLocalStorage[nodeId]["reads"][read] = globalReads[it+1]; 
        //     });           
        // }
        return false;
    }

    this.exitFunction = function(nodeId, params){
        shadowStack.pop();
        if (shadowStack.length) 
            _shadowStackHead = shadowStack[shadowStack.length - 1];
        else _shadowStackHead = null;

        if (customLocalStorage[nodeId]["arguments"]) {
            for (var p in customLocalStorage[nodeId]["arguments"]["before"])
                customLocalStorage[nodeId]["arguments"]["after"][p] = params[p];
        }
    }

    this.dumpArguments = function(nodeId, params) {
        // functionTimerE[nodeId] = performance.now();
        // window.sigStack[nodeId].push(functionTimerE[nodeId] - functionTimerS[nodeId]);
        // return;
        if (customLocalStorage[nodeId]["arguments"])
            customLocalStorage[nodeId]["arguments"]["after"] = params;
        shadowStack.pop();

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

    var escapeRegExp = function(str) {
        return str.replace(/[\"]/g, "\\$&");
    }

    var isNative = function(fn) {
        return (/\{\s*\[native code\]\s*\}/).test('' + fn);
    }

    var stringify = function (obj) {

        return JSON.stringify(obj, function (key, value) {
            var DUMMYOBJ = {}
          // if (value == document || value == window ) 
          //   return DUMMYOBJ;
          // if (value && value.self == value)
          //   return DUMMYOBJ;

          var fnBody;
          if (value instanceof Function || typeof value == 'function') {

            if ((/\{\s*\[native code\]\s*\}/).test(value.toString())) {
                nativeObjectsStore[key] = value;
                return {};
            }
            fnBody = value.toString();

            if (fnBody.length < 8 || fnBody.substring(0, 8) !== 'function') { //this is ES6 Arrow Function
              return '_NuFrRa_' + fnBody;
            }
            return fnBody;
          }
          if (value instanceof RegExp) {
            return '_PxEgEr_' + value;
          }
          return value;
        });
    };

    var parse = function (str, date2obj) {

    var iso8061 = date2obj ? /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2}(?:\.\d*)?)Z$/ : false;

    return JSON.parse(str, function (key, value) {
        var prefix;

        if (typeof value != 'string') {
        return value;
        }
        if (value.length < 8) {
        return value;
        }

        prefix = value.substring(0, 8);

        if (iso8061 && value.match(iso8061)) {
            return new Date(value);
        }
        if (prefix === 'function') {
            // if ((/\{\s*\[native code\]\s*\}/).test(value))
            //     return nativeObjectsStore[key]
            return eval('(' + value + ')');
        }
        if (prefix === '_PxEgEr_') {
            return eval(value.slice(8));
        }
        if (prefix === '_NuFrRa_') {
            return eval(value.slice(8));
        }

        return value;
        });
    };

	this.Array = Array;

    var isReplay = localStorage.getItem("executionCount");
    if (isReplay){
        // customLocalStorage = extractCacheObject();
        console.log("Restored custom local storage");
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
        case 1: //ELEMENT_NODE
          node = document.createElement(obj.tagName);
          var attributes = obj.attributes || [];
          for (var i = 0, len = attributes.length; i < len; i++) {
            var attr = attributes[i];
            node.setAttribute(attr[0], attr[1]);
          }
          break;
        case 3: //TEXT_NODE
          node = document.createTextNode(obj.nodeValue);
          break;
        case 8: //COMMENT_NODE
          node = document.createComment(obj.nodeValue);
          break;
        case 9: //DOCUMENT_NODE
          node = document.implementation.createDocument();
          break;
        case 10: //DOCUMENT_TYPE_NODE
          node = document.implementation.createDocumentType(obj.nodeName);
          break;
        case 11: //DOCUMENT_FRAGMENT_NODE
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


            var objects = new WeakMap();     // object to path mappings

            return (function derez(value, path) {


                var old_path;   // The path of an earlier occurance of value
                var nu;         // The new object or array

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
});

    class SignatureProcessor{

        constructor(signature, objectTree, idToObject, callGraph){
            this.signature = signature;
            this.objectTree = objectTree;
            this.processedSig = {};
            this.objectToPath = {};
            this.idToObject = idToObject;
            this.callGraph = callGraph;
        }

        process(){
            var objectToPath = this.objectToPath;
            var objectTree = this.objectTree;
            var signature = this.signature;
            var processedSig = this.processedSig;
            var idToObject = this.idToObject;
            var reverseObjectToId = {};

            var init = function(){
                objectToPath[0] = "window";
            }

            var _removeRedundantReads = function(nodeId, writeArray){
                var readLength = signature[nodeId].reads.length;
                if (readLength) {
                    while (readLength--){
                        if ( signature[nodeId].reads[readLength][0] == writeArray[0] && signature[nodeId].reads[readLength][1] == writeArray[1] )
                            signature[nodeId].reads.splice(readLength, 1);
                    }
                }
            }
            var removeReduntantReads = function(){
                for (var nodeId in signature){
                    if (signature[nodeId].writes.length) {
                        signature[nodeId].writes.forEach(function(write){
                            _removeRedundantReads(nodeId, write);
                        })
                    }
                }
            }

            /*
            While constructing paths instead of using the dot operator for properties
            we use the bracket operators for two reasons
            - If the property is a number
            - if the property has special symbols like dot itlelf or spaces
            */

            var constructPath = function(objectId){
                if (objectToPath[objectId]) return objectToPath[objectId];
                var path = "";
                for (var nodeId in objectTree){
                    for (var edge in objectTree[nodeId]) {
                        var _id = objectTree[nodeId][edge].indexOf(objectId);
                        if (_id) {
                            var parentPath = constructPath(nodeId);
                            path = parentPath + "['" + edge.substr(2) + "']";
                            objectToPath[objectId] = path;
                            return path;
                        }
                    }
                }
                console.error("NO PATH FOUND FOR OBJECT ID: " + objectId);
            }

            var reverseLookup = function(objectId) {
                if (reverseObjectToId[objectId]) return reverseObjectToId[objectId];

            }

            var preProcess = function(){
                for (var nodeId in objectTree) {
                    var parentPath = constructPath(nodeId);
                    if (!parentPath) console.error("NO PARENT PATH FOUND WHILE PREPROCESSING " + nodeId );
                    for (var edge in objectTree[nodeId]) {
                        objectTree[nodeId][edge].forEach(function(objectId){
                             if (!objectToPath[objectId]) {
                                var path = parentPath + "['" + edge.substr(2) + "']";
                                objectToPath[objectId] = path;
                            }
                        })
                    }
                }
            }

            var fetchValue = function(log){
                var _id = parseInt(log);
                if (!isNaN(_id))
                    return idToObject.get(_id);
                else
                    return log.substr(2);
            }

            var processRead = function(nodeId){
                var readSignature;
                var readArray = signature[nodeId].reads;
                processedSig[nodeId].reads = [];
                readArray.forEach(function(read){
                    var parentPath = objectToPath[read[0]];
                    if (!parentPath) console.log("no parent path found for object id:" + JSON.stringify(read) + " " + nodeId);
                    try {
                        var readString;
                        if (typeof read[1] == 'symbol')
                            readString = read[1].toString()
                        else readString = read[1] + '';
                        var path = parentPath + "['" + readString + "']";
                        readSignature = path + " = " + JSON.stringify(fetchValue(read[2]));
                    } catch (e) {
                        // console.log("Error while trying to stringify path: " + e + e.stack);
                    }
                    processedSig[nodeId].reads.push(readSignature);
                })
            }

            var processWrite = function(nodeId){
                var writeSignature;
                var writeArray = signature[nodeId].writes;
                processedSig[nodeId].writes = [];
                writeArray.forEach(function(write){
                    var parentPath = objectToPath[write[0]];
                    if (!parentPath) console.log("no parent path found for object id:" + JSON.stringify(write) + " " + nodeId);
                    var path = parentPath + "['" + write[1] + "']"; 
                    try {
                        writeSignature = path + " = " + JSON.stringify(fetchValue(write[2]));
                    } catch (e) {
                        // console.log("Error while stringifying path: " + e + e.stack);
                    }
                    processedSig[nodeId].writes.push(writeSignature);
                })

            }

            init();
            preProcess();
            //cleanup signatures ie remove a read after write
            // removeReduntantReads();

            Object.keys(this.signature).forEach(function(nodeId){
                processedSig[nodeId] = {};
                if (signature[nodeId].reads.length)
                    processRead(nodeId)
                if (signature[nodeId].writes.length)
                    processWrite(nodeId)
                processedSig[nodeId].arguments = signature[nodeId].arguments;
                processedSig[nodeId].returnValue = signature[nodeId].returnValue;
            });

        }

        postProcess() {
            var processedSig = this.processedSig;

            var _removeRedundantReads = function(keyArray){
                var redundantIndices = [];
                keyArray.forEach(key => {
                    var indices = keyArray.keys();
                    for (var i of indices) {
                        if (key.trim().indexOf(keyArray[i].trim()) >= 0 && keyArray[i].trim() != key.trim())
                            redundantIndices.push(i);
                    }
                });

                return redundantIndices;
            }

            var removeReduntantReads = function(nodeId){
                var readArray = processedSig[nodeId].reads;
                var keys = readArray.map(key => key.split('=')[0].trim());
                var redundantIndices = _removeRedundantReads(keys);
                redundantIndices.forEach(index => {
                    readArray.splice(index, 1);
                });
            }

            Object.keys(processedSig).forEach(function(nodeId){
                // removeReduntantReads(nodeId);
                var readArray = processedSig[nodeId].reads;
                if (readArray && readArray.length) {
                    readArray = new Set(readArray);
                    processedSig[nodeId].reads = readArray;
                }
                var writeArray = processedSig[nodeId].writes;
                if (writeArray && writeArray.length) {
                    writeArray = new Set(writeArray);
                    processedSig[nodeId].writes = writeArray;
                }

            });
        }

        signaturePropogate() {
            var callGraph = this.callGraph;
            var processedSig = this.processedSig;

            var mergeArray = function(dstSig, srcSig) {
                srcSig.forEach((sig) => {
                    dstSig.add(sig);
                });
            }

            var mergeInto = function(dstNode, srcNode) {
                if (processedSig[srcNode].reads) {
                    if (!processedSig[dstNode].reads) 
                        processedSig[dstNode].reads = new Set();
                    mergeArray(processedSig[dstNode].reads, processedSig[srcNode].reads);
                }

                if (processedSig[srcNode].writes) {
                    if (!processedSig[dstNode].writes ) 
                        processedSig[dstNode].writes = new Set();
                    mergeArray(processedSig[dstNode].writes, processedSig[srcNode].writes);
                }
            }

            var traverseGraph = function() {
                Object.keys(callGraph).forEach((nodeId) => {
                    var children = callGraph[nodeId];
                    children.forEach((child) => {
                        mergeInto(nodeId, child);
                    });
                });
            }

            traverseGraph();

        }
    }

}
(function () { {name}.setGlobal(this); })();















