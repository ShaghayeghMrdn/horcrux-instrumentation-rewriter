

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

/*
Keywords to manage code base better 

TODO - code sections need to be reimplemented or handled better
SUPPRESS - caught exceptions which our suppressed - need to be handled better
LOG - log statements which are used to debug

TODO 

    - Fine tracking of arguments
        - Instead of stringifying the entire argument object, only track object level changes (read, write) to the individual object
    - Signature Propagation
        - While trying to build the call graph, some nodes are not found: Is it because I am deleting nodes while stringifying? 
*/

if (typeof {name} === 'undefined') {
{name} = new (function () {
    var e2eTesting = {e2eTesting};
    var functions = new Set();
    var invocations = {};
    var customLocalStorage = {}; /* Use this in place of the localstorage API for faster access. */
    var counter = 0;
    var shadowStack = [];
    var _shadowStackHead;
    var ObjectTree = {};
    var objectIdCounter = 1;
    var proxyToThis = new WeakMap();
    var methodToProxy = new WeakMap();
    var proxyToMethod = new WeakMap();
    var ObjectToId = new WeakMap();
    var idToObject = new Map();
    var processedSignature = {};
    var objectToPath;
    var callGraph = {};
    var functionsSeen = [];
    var pageRecorded = false;
    var simpleReplay = true;
    var cacheStats = {hits: 0, misses: 0, nulls: 0}
    var functionStats = {noarg:0, prim: 0, prim_objects:0, else: 0};

    var invocationsIndName = {};
    var invocationsIndState = {};


    //temporary hack to store non stringifiable functions
    var nonCacheableNodes = {};

    /* Initialize the object tree with window as the root object*/
    ObjectToId.set(window,0);
    ObjectTree[0] = {};

    //Make a point to comment unsused comments otherwise you can have unforseen errors
    // like some pages can't access the following localstorage object
    // var pageRecorded = localStorage.getItem("recordedPage");
    if (pageRecorded && e2eTesting) {
        console.log("Retrieving stored signature from cache")
        pageRecorded = true;
        var stringifiedSignature = JSON.parse(localStorage.getItem("PageLocalCache"));
        for (var nodeId in stringifiedSignature) {
            processedSignature[nodeId] = parse(stringifiedSignature[nodeId]);
            for ( var argInd in processedSignature[nodeId].arguments.after )
                processedSignature[nodeId].arguments.after[argInd] = parse(processedSignature[nodeId].arguments.after[argInd]);
        }

        // customLocalStorage = JSON.parse(localStorage.getItem("PageLocalCache"));
    }


    var storeSignatureInCache = function(signature) {
        var circularSignatures = 0;
        var cacheableSignature = {};
        for (var nodeId in signature) {
            try {
                cacheableSignature[nodeId] = stringify(signature[nodeId]);
            } catch (e) {
                circularSignatures++;
            }
        }

        try { 
            localStorage.setItem("PageLocalCache", JSON.stringify(cacheableSignature));
        } catch (e) {
            //SUPPRESS
            // console.log("Error while storing cacheableSignature " + e);
        }
        console.log("Dumped the signature");
        console.log("Number of functions with circular objects in their signature " + circularSignatures);
        console.log("compared to total number of nodes  " + Object.keys(signature).length);
    }

    var getFunctionStat = function(key){
        var types = key.split(';;');
        if (types.indexOf("0")>=0) return "noarg";
        else if (types.indexOf("function")>=0) return "else";
        else if (types.indexOf("object")>=0) return "prim_objects";
        else return "prim";
    }

    window.addEventListener("load", function(){
        if (!pageRecorded) {
            console.log("PROXY STATS");
            console.log(window.proxyReadCount, window.proxyWriteCount);
            window.{proxyName} = window;

            //Process invocation keys and determine function types
            for (var i in invocations){
                functionStats[getFunctionStat(i)] += invocations[i];
            }

            // Since we are only using the cache from the first load
            // for now we would comment all the post processing code.
            
            // Process the signature to construct meaningful paths
            var sigProcessor = new SignatureProcessor(customLocalStorage, ObjectTree, idToObject, callGraph);
            sigProcessor.process();
            sigProcessor.postProcess();

            // // //Commenting out signature propogation for now
            // // //TODO
            sigProcessor.signaturePropogate();
            // // /*
            // // Setting the global variables with class fields
            // // */
            processedSignature = sigProcessor.processedSig;
            objectToPath = sigProcessor.objectToPath;

            // storeSignatureInCache(processedSignature);
            // console.log("Dumping cache to local storage")
            // localStorage.setItem("PageLocalCache", JSON.stringify(processedSignature));
            // The following key enables caching
            // localStorage.setItem("recordedPage", 1);
        } else {
            console.log("Page successfully replayed");
        }

    })

    // var observer = new MutationObserver(callback);
    // observer.observe(document, config);

    /* Proxy object handler */
    window.proxyReadCount =0; window.proxyWriteCount = 0;


    // Rewrite the Object.setPrototypeOf method

    let _setProtoTypeof = Object.setPrototypeOf;
    Object.setPrototypeOf = function (obj, prototype) {
        if (prototype && prototype.__isProxy)
            prototype = prototype.__target;
        return _setProtoTypeof(obj, prototype);
    }
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

    var stateAlreadyLogged = function(nodeId, logTup, logType){
        var stateLogged = false;
        customLocalStorage[nodeId][logType].forEach((tupEntry)=>{
            if (JSON.stringify(tupEntry) == JSON.stringify(logTup))
                stateLogged = true;
        })
        return stateLogged;
    }

    var loggerFunction = function(target, key, value, logType){
        if (key == "__isProxy" || key == "top" || key == "parent" || document.readyState == "complete") return;
        var nodeId = _shadowStackHead ? _shadowStackHead : null;
        // var nodeId = _nodeId + "_count" + invocationsIndName[_nodeId];
        //TODO only storing signature of the first invocation and not including the signature of future 
        //invocations. 
        if (!nodeId || (nodeId && (functionsSeen.indexOf(nodeId) >= 0 || nonCacheableNodes[nodeId]) ) ) return;
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

        if (logType == "reads") {
            if (!stateAlreadyLogged(nodeId, [rootId, key, childId], "reads"))
                customLocalStorage[nodeId]["reads"].push([rootId, key, childId]);
        }
        else {
            if (!stateAlreadyLogged(nodeId, [rootId, key, childId], "writes"))
                customLocalStorage[nodeId]["writes"].push([rootId, key, childId]);
        }
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

    var outOfScopeProperties = ["location", "body", "Promise", "top", "parent", "prototype", "__proto__"];

    var handler = {
      get(target, key, receiver) {
        var method = Reflect.get(target,key);
        if (key == "__isProxy") return true;
        if (key == "__target") return target;
        loggerFunction(target, key, method, "reads");
        /* If method type if function, don't wrap in proxy for now */
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
          /*
          The following check is kind of inconsequental, cause even if you have a proxy around the method call or apply, the apply handler 
          will be anyway called
          */
          if (key == "apply" || key == "call") return method;
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

      /*
      Let p be a proxy object. The following event handler will be called :
       - if p if a function itself, p(arg) : target -> p, thisArg -> window, args = args
       - if you do p.call or p.apply, first you go inside the get handler, read the value, and then go inside the apply handler
      */

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
      },
      setPrototypeOf (target, prototype) {
        return Reflect.setPrototypeOf(target, prototype);
      },
      getPrototypeOf (target) {
        return Reflect.getPrototypeOf(target);
      },
      getOwnPropertyDescriptor (target, propertyKey) {
        return Reflect.getOwnPropertyDescriptor(target, propertyKey);
      },
      ownKeys (target) {
        return Reflect.ownKeys(target)
      },
      has (target, propertyKey) {
        return Reflect.has(target, propertyKey);
      },
      isExtensible (target) {
        return Reflect.isExtensible(target)
      },
      defineProperty (target, propertyKey, attributes) {
        return Reflect.defineProperty(target, propertyKey, attributes);
      },
      deleteProperty (target, propertyKey) {
        return Reflect.deleteProperty(target, propertyKey);
      },
      preventExtensions (target) {
        return  Reflect.preventExtensions(target);
      }

    }

    var {proxy, revoke} = Proxy.revocable(window, handler);
    // Flag to disable proxy
    window.{proxyName} = proxy;
    // window.{proxyName} = window;
    proxyToMethod.set(proxy, window);

    if (pageRecorded && e2eTesting)
        window.{proxyName} = window;

    this.argProxyHandler = {

    };


    this.getShadowStack = function(clear){
        if (clear)
            _shadowStackHead = null;
        return shadowStack;
    }
    this.getNonCacheableFunctions = function() {
        // return Array.from(new Set(nonCacheableNodes));
        return nonCacheableNodes;
    }

    this.getCallGraph = function() {
        return callGraph;
    }

    this.getFunctionStats = function() {
        return functionStats;
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

    this.handleProtoAssignments = function(targetPrototype) {
        if (targetPrototype.__isProxy)
            return targetPrototype.__target;
        else return targetPrototype;
    }

    this.handleProxyComparisons = function(...rhs){
        if (!rhs[0]) return rhs[0];
        if (rhs.length > 1 ) return rhs[rhs.length - 1];
        else if (rhs[0] && rhs[0].__isProxy) return rhs[0].__target;
        else return rhs[0];
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
        if (pageRecorded) return returnValue;
        if (functionsSeen.indexOf(nodeId) >= 0) return returnValue;
        /* 
        Check in case there is a logreturn statement but the function was uncacheable
        usually happens when there is an antilocal written to after the return statement inside a function
        */ 
        if (invocationsIndName[functionIdentifier] == null){
            console.error("No invocation count for the nodeId " + functionIdentifier);
            return;
        }

        var cacheIndex = functionIdentifier + "_count" + invocationsIndName[functionIdentifier];
        if (customLocalStorage[cacheIndex]) customLocalStorage[cacheIndex]["returnValue"] = returnValue;
        return returnValue;
    }

    var logNonProxyParams = function(nodeId,params){
        for(var i in params) {
            try {
                if (params[i] != null && !params[i].__isProxy)
                    customLocalStorage[nodeId]["arguments"]["before"][i] =  stringify(params[i]);
            } catch (e) {
                // console.log("Error while stringifying the before state of arguments. " + e + e.stack);
                // SUPPRESS
                //Discard the entire signature 
                delete customLocalStorage[nodeId];
                nonCacheableNodes[nodeId] = "circular";
                // Even if one is non stringiable return out
                return;
            }
        }
    }


    var mergeObjects = function(src, dst){
        for (var property in src) {
            dst[property] = src[property];
        }
    }

    var verifyAndReplayCache = function(nodeId, params) {
        var processedSignature = customLocalStorage;
        if (simpleReplay && (processedSignature[nodeId] && processedSignature[nodeId].reads.length || processedSignature[nodeId].writes.length)) {
            //Only cache objects with simple signatures
            nonCacheableNodes[nodeId] = "global";
            return false;
        }

        // Compare the input state only params
        if (processedSignature[nodeId].arguments){
            for (var index in processedSignature[nodeId].arguments.before) {
                try {
                    if (stringify(params[index]) != processedSignature[nodeId].arguments.before[index]) {
                        //cache miss
                        cacheStats.misses++;
                        // console.log("Cache miss " + nodeId);
                        return false;
                    }
                } catch(e) {
                    //SUPPRESS
                    nonCacheableNodes[nodeId] = "circular";
                    return false;
                }
            }
        } else { 
            cacheStats.nulls++;
            // console.log(nodeId + " contains neither global state changes nor arguments");
            return false;
        }

        for (var index in processedSignature[nodeId].arguments) {
            mergeObjects(processedSignature[nodeId].arguments.after[index], params[index]);
            // params[index] = processedSignature[nodeId].arguments.after[index];
        }

        var returnValue = processedSignature[nodeId].returnValue || true;
        cacheStats.hits++;
        // console.log("cache hit " + nodeId);
        return returnValue;
    }

    var getArgTypes = function(args, delim){
        var argTypes = "";
        for (var a of args) 
            argTypes += typeof a + delim;
        return argTypes;
    }

    this.cacheInit = function(nodeId, params){
        if (invocationsIndName[nodeId] != null)
            invocationsIndName[nodeId]++;
        else invocationsIndName[nodeId] = 0;

        var cacheIndex = nodeId + "_count" + invocationsIndName[nodeId];

        if (!callGraph[cacheIndex])
            callGraph[cacheIndex] = [];

        if (nonCacheableNodes[nodeId]) {
            return false;
        }

        /*
        * The following snippet analyses the 
        * type of functions based on their arguments
        * data type
        */
        /*
        let key = nodeId;
        const delim = ';;';
        var _sig = getArgTypes(params,delim);

        if (_sig.indexOf("function") >= 0 ) {
            nonCacheableNodes[nodeId] = "arg";
            return false;
        }

        key +=  delim + params.length + delim + _sig;

        if (invocations[key])
            invocations[key]++;
        else invocations[key] = 1;
        */

        if (_shadowStackHead) {
            callGraph[_shadowStackHead].push(cacheIndex)
            // nonCacheableNodes[nodeId] = "callee";
        }

        shadowStack.push(cacheIndex);
        _shadowStackHead = cacheIndex;

        if (customLocalStorage[cacheIndex])
            console.error("Same function with same invocation id", cacheIndex);

        customLocalStorage[cacheIndex] = {}
        customLocalStorage[cacheIndex]["writes"] = [];
        customLocalStorage[cacheIndex]["reads"] = [];
        if (params && params.length != 0) {
            customLocalStorage[cacheIndex]["arguments"] = {};
            customLocalStorage[cacheIndex]["arguments"]["before"] = {};
            customLocalStorage[cacheIndex]["arguments"]["after"] = {};
            logNonProxyParams(cacheIndex, params);
        }
    }

    this.cacheAndReplay = function(nodeId, params, info){

        // if (!customLocalStorage[nodeId]) {
        //     customLocalStorage[nodeId] = {};
        //     customLocalStorage[nodeId]["writes"] = [];
        //     customLocalStorage[nodeId]["reads"] = [];
        //     if (params.length != 0) {
        //         customLocalStorage[nodeId]["arguments"] = {};
        //         customLocalStorage[nodeId]["arguments"]["before"] = {};
        //         customLocalStorage[nodeId]["arguments"]["after"] = {};
        //         logNonProxyParams(nodeId, params);
        //     }
        // } else {
        //     /*
        //         Enables cache replay during the first load
        //         In memory cache replay, avoid the need for stringification
        //     */
        //     // var returnValue = verifyAndReplayCache(nodeId, params);
        //     // return returnValue;
        //     return false;
        //     // console.log("Cache hit for function " + nodeId);
        //     // var returnValue = customLocalStorage[nodeId]["returnValue"] ? customLocalStorage[nodeId]["returnValue"] : true;
        //     // if (params && customLocalStorage[nodeId]["arguments"]){
        //     //     Object.keys(customLocalStorage[nodeId]["arguments"]["after"]).forEach(function(ind){
        //     //         params[ind] = customLocalStorage[nodeId]["arguments"]["after"][ind];
        //     //     });
        //     // }
        //     // if (customLocalStorage[nodeId]["writes"]) {
        //     //     for (var writeIndex  = 0; writeIndex < customLocalStorage[nodeId]["writes"].length; writeIndex++) {
        //     //         var evalString = customLocalStorage[nodeId]["writes"][writeIndex];
        //     //         eval(evalString);
        //     //     };
        //     // }

        //     // return returnValue;
        // }

        return false;
    }

    this.exitFunction = function(nodeId, params){
        var cacheIndex = nodeId + "_count" + invocationsIndName[nodeId];
        if (pageRecorded) return;
        //TODO handle multiple invocations
        if (functionsSeen.indexOf(nodeId) >= 0) return;
        // functionsSeen.push(nodeId);
        shadowStack.pop();
        if (shadowStack.length) 
            _shadowStackHead = shadowStack[shadowStack.length - 1];
        else _shadowStackHead = null;

        // Since the signature might be discarded, first check if the customStorage entry exists and then check for arguments
        if (customLocalStorage[cacheIndex] && customLocalStorage[cacheIndex]["arguments"]) {
            for (var p in customLocalStorage[cacheIndex]["arguments"]["before"]) {
                try {
                    customLocalStorage[cacheIndex]["arguments"]["after"][p] = stringify(params[p]);
                } catch (e) {
                    //SUPPRESS
                    console.log("Error while stringifying arguments object " + e + e.stack);
                    //discard the entire signature
                    delete customLocalStorage[nodeId];
                }
            }
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

    var escapeRegExp = function(str) {
        return str.replace(/[\"]/g, "\\$&");
    }

    var isNative = function(fn) {
        return (/\{\s*\[native code\]\s*\}/).test('' + fn);
    }

    function stringify(obj) {

        return JSON.stringify(obj, function (key, value) {

          var fnBody;
          if (value instanceof Function || typeof value == 'function') {

            if ((/\{\s*\[native code\]\s*\}/).test(value.toString())) {
                return {};
            }
            fnBody = value.toString();

            if (fnBody.length < 8 || fnBody.substring(0, 8) !== 'function') { /*this is ES6 Arrow Function*/
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

    function parse(str, date2obj) {

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

            var stringify = function (obj) {

                return JSON.stringify(obj, function (key, value) {

                  var fnBody;
                  if (value instanceof Function || typeof value == 'function') {

                    if ((/\{\s*\[native code\]\s*\}/).test(value.toString())) {
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
                        readSignature = path + " = " + stringify(fetchValue(read[2]));
                    } catch (e) {
                        //TODO
                        //suppressing for now
                        //SUPPRESS
                        // console.log("Error while trying to stringify path: " + e + e.stack);
                    }
                    if (readSignature)
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
                        writeSignature = path + " = " + stringify(fetchValue(write[2]));
                    } catch (e) {
                        //TODO
                        //suppressing for now
                        //SUPPRESS
                        // console.log("Error while stringifying path: " + e + e.stack);
                    }
                    if (writeSignature)
                        processedSig[nodeId].writes.push(writeSignature);
                })

            }

            init();
            preProcess();
            //cleanup signatures ie remove a read after write
            // removeReduntantReads();

            Object.keys(this.signature).forEach(function(nodeId){
                processedSig[nodeId] = {};
                if (signature[nodeId].reads && signature[nodeId].reads.length)
                    processRead(nodeId)
                if (signature[nodeId].writes && signature[nodeId].writes.length)
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

                return [...(new Set(redundantIndices))]
            }

            var removeReduntantReads = function(nodeId){
                var readArray = processedSig[nodeId].reads;
                var keys = readArray.map(key => key.split('=')[0].trim());
                var redundantIndices = _removeRedundantReads(keys);
                for (var index = redundantIndices.length-1; index >= 0; index--)
                    readArray.splice(redundantIndices[index],1);
                // redundantIndices.forEach(index => {
                //     readArray.splice(index, 1);
                // });
            }

            Object.keys(processedSig).forEach(function(nodeId){
                if (processedSig[nodeId].reads)
                    removeReduntantReads(nodeId);
                // var readArray = processedSig[nodeId].reads;
                // if (readArray && readArray.length) {
                //     readArray = new Set(readArray);
                //     processedSig[nodeId].reads = readArray;
                // }
                // var writeArray = processedSig[nodeId].writes;
                // if (writeArray && writeArray.length) {
                //     writeArray = new Set(writeArray);
                //     processedSig[nodeId].writes = writeArray;
                // }

            });
        }

        signaturePropogate() {
            var callGraph = this.callGraph;
            var processedSig = this.processedSig;

            var mergeArray = function(dstSig, srcSig) {
                srcSig.forEach((sig) => {
                    if (dstSig.indexOf(sig) < 0)
                        dstSig.push(sig);
                });
            }

            var mergeInto = function(dstNode, srcNode) {
                if (processedSig[srcNode] && processedSig[srcNode].reads) {
                    if (processedSig[dstNode] && !processedSig[dstNode].reads) 
                        processedSig[dstNode].reads = [];
                    mergeArray(processedSig[dstNode].reads, processedSig[srcNode].reads);
                }

                if (processedSig[srcNode] && processedSig[srcNode].writes) {
                    if (processedSig[dstNode] && !processedSig[dstNode].writes ) 
                        processedSig[dstNode].writes = [];
                    mergeArray(processedSig[dstNode].writes, processedSig[srcNode].writes);
                }
            }

            var traverseGraph = function() {
                Object.keys(callGraph).forEach((nodeId) => {
                    var children = callGraph[nodeId];
                    children.forEach((child) => {
                        if (processedSig[nodeId])
                            mergeInto(nodeId, child);
                    });
                });
            }

            /*
            Need to propagate the signature twice, due to the order of invocation
            eg: callgraph -> function0 : function 1
                             function1 : function2
                             if 1 is propagated to 0 before 2 is propagated to 1, then 0 won't 
                             contain 2'signature.
            */
            traverseGraph();
            traverseGraph();

        }
    }

}
(function () { {name}.setGlobal(this); })();















