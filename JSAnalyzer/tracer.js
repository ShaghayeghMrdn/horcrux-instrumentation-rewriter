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
    var trackOnlyLeaf = true;
    var functions = new Set();
    var invocations = {};
    var customLocalStorage = {}; /* Use this in place of the localstorage API for faster access. */
    var counter = 0;
    var shadowStack = [];
    var _shadowStackHead;
    var processedSignature = {};
    var callGraph = {};
    var functionsSeen = [];
    var pageRecorded = false;
    var simpleReplay = true;
    var cacheStats = {hits: 0, misses: 0, nulls: 0}
    var functionStats = {noarg:[], prim: [], prim_objects:[], function: []};
    var nonCacheableNodes = {};
    var invocationsIndName = {};
    var invocationsIndState = {};
    var invocationToArgProxy = {};
    var invocationToThisProxy = {}
    var invocationToClosureProxy = {};
    var keysToStdKeys = {};
    var cacheableSignature = {};
    var pageLoaded = false;
    var INVOCATION_LIMIT = 500;

    //Define all your custom methods, before they are overwritten
    //by user javascript
    // Declare all the custom prototype methods here
    var customMethods = {getOwnPropertyDescriptor: Object.getOwnPropertyDescriptor}

    //temporary hack to store non stringifiable functions
    // var nodesByProperties = {
    //     "NOGSNOARG":[], "GS_f":[], "GS":[],
    //     "Function":{}, "RTI":{RTI}, 
    //     "antiLocal":{antiLocal},"ND":{ND}, "DOM":{DOM}
    // };
    var nodesByProperties = {
      "antiLocal":{antiLocal}, "function":[], "nonFunction": []  
    }

    // nodesByProperties.Function = functionStats;
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

    var getFunctionStat = function(key){

        var types = key.split(';;');
        // if (types.indexOf("0")>=0) return "noarg";
        if (types.indexOf("function")>=0) return "function";
        else if (types.indexOf("object")>=0) return "prim_objects";
        else return "prim";
    }

    window.addEventListener("load", function(){
        if (!pageRecorded) {
            console.log("PROXY STATS");
            console.log(window.proxyReadCount, window.proxyWriteCount);
            window.{proxyName} = window;
            pageLoaded = true;

            // processFinalSignature();
            // processInvocationProperties();
            // storeSignatureInCache(processedSignature);
            // console.log("Dumping cache to local storage")
            // localStorage.setItem("PageLocalCache", JSON.stringify(processedSignature));
            // The following key enables caching
            // localStorage.setItem("recordedPage", 1);
        } else {
            console.log("Page successfully replayed");
        }

    })

    var processFinalSignature = function(){
        // First process the global state of every function
        var proxyPrivates = globalProxyHandler.accessToPrivates();
        // Process the signature to construct meaningful paths
        var sigProcessor = new SignatureProcessor(customLocalStorage, proxyPrivates.ObjectTree, callGraph, "global");
        sigProcessor.process();
        sigProcessor.postProcess();
        // sigProcessor.signaturePropogate();
        processedSignature = sigProcessor.processedSig;

        //Now individual iterate the invocations and convert object ids to strings
        Object.keys(invocationToArgProxy).forEach((invocationId)=>{
             // Return if not leaf node
            if (trackOnlyLeaf &&  callGraph[invocationId].length) return;
            var argProxyHandler = invocationToArgProxy[invocationId];
            var proxyPrivates = argProxyHandler.accessToPrivates();
            var invocationSignature = {};
            invocationSignature[invocationId] = processedSignature[invocationId];
            var sigProcessor = new SignatureProcessor(invocationSignature, proxyPrivates.ObjectTree, callGraph, "argument");
            sigProcessor.process();
            sigProcessor.postProcess();
            processedSignature[invocationId] = sigProcessor.processedSig[invocationId];
        })

        Object.keys(invocationToThisProxy).forEach((invocationId)=>{
            // Return if not leaf node
            if (trackOnlyLeaf && callGraph[invocationId].length) return;
            var thisProxyHandler = invocationToThisProxy[invocationId];
            var proxyPrivates = thisProxyHandler.accessToPrivates();
            var invocationSignature = {};
            invocationSignature[invocationId] = processedSignature[invocationId];
            var sigProcessor = new SignatureProcessor(invocationSignature, proxyPrivates.ObjectTree, callGraph, "this");
            sigProcessor.process();
            sigProcessor.postProcess();
            processedSignature[invocationId] = sigProcessor.processedSig[invocationId];
        })

        Object.keys(invocationToClosureProxy).forEach((invocationId)=>{
            // Return if not leaf node
            if (trackOnlyLeaf && callGraph[invocationId].length) return;
            var closureProxyHandler = invocationToClosureProxy[invocationId];
            var proxyPrivates = closureProxyHandler.accessToPrivates();
            var invocationSignature = {};
            invocationSignature[invocationId] = processedSignature[invocationId];
            var sigProcessor = new SignatureProcessor(invocationSignature, proxyPrivates.ObjectTree, callGraph, "closure");
            sigProcessor.process();
            sigProcessor.postProcess();
            processedSignature[invocationId] = sigProcessor.processedSig[invocationId];
        })

        console.log("Done processing final signature")

        //garbage cleaning
        delete invocationToArgProxy;
        delete globalProxyHandler;
        delete customLocalStorage;
        delete invocationToClosureProxy;

    }

    var storeSignature = function(){
        Object.keys(processedSignature).forEach((invocId)=>{
            var strSig = stringify(processedSignature[invocId]);
            if (strSig && strSig.__proto__.__proto__ == "Error") {
                nonCacheableNodes[invocId.split("_count")[0]] = "stringify";
                return;
            }

            //convert the original signature in the string format, to do a memory comparison
            processedSignature[invocId] = strSig;
            var _matchInvocId, matchInvocId;
            if (_matchInvocId=Object.values(cacheableSignature).indexOf(strSig)>=0){
                matchInvocId = Object.keys(cacheableSignature)[_matchInvocId];
                keysToStdKeys[invocId] = matchInvocId;
            } else {
                cacheableSignature[invocId] = strSig;
                keysToStdKeys[invocId] = invocId;
            }
        })

        console.log(Object.keys(processedSignature).length + " coalesced into " + Object.keys(cacheableSignature).length);
    }

    this.storeSignature = storeSignature;

    this.processFinalSignature = processFinalSignature;

    this.getKeysToStdKeys = function(){
        return keysToStdKeys;
    }

    this.getStoredSignature = function(){
        return cacheableSignature;
    }

    var processInvocationProperties = function(){
        //Iterate processed signature instead of customLocalStorage object
        Object.keys(processedSignature).forEach((nodeId)=>{
            var propertyObj = processedSignature[nodeId];
            // if (!propertyObj.reads.length && !propertyObj.writes.length && !propertyObj.argProp) {
            //     // if (nodesByProperties.DOM.indexOf(nodeId)<0 && nodesByProperties.antiLocal.indexOf(nodeId)<0)
            //         nodesByProperties.NOGSNOARG.push(nodeId);
            // } else if ( (propertyObj.reads && propertyObj.reads.length) || ( propertyObj.writes && propertyObj.writes.length) ) {
            //     if (propertyObj.argProp && getFunctionStat(propertyObj.argProp) == "function")
            //         nodesByProperties.GS_f.push(nodeId);
            //     else nodesByProperties.GS.push(nodeId);
            // }
            // else {
            //     var argType = getFunctionStat(propertyObj.argProp);
            //     nodesByProperties.Function[argType].push(nodeId);
            // }
            if (nodesByProperties.antiLocal.indexOf(nodeId) < 0) {
                if (propertyObj.isFunction)
                    nodesByProperties.function.push(nodeId)
                else nodesByProperties.nonFunction.push(nodeId);
            }
        });
    }

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

    // var _eval = window.eval;
    // window.eval = function(arg){
    //     window.{name}.insideEval = true;
    //     _eval(arg);
    //     window.{name}.insideEval = false;
    // }
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
    function proxyEncapsulation(rootObject, type) {

        var ObjectTree = {};
        var objectIdCounter = 1;
        var methodToProxy = new WeakMap();
        var proxyToMethod = new WeakMap();
        var ObjectToId = new WeakMap();
        var objectToPath;
        var parentFunctionId = null;
        var rootType = type;
        if (rootType == "argument" || rootType == "this" || rootType == "closure")
            parentFunctionId = _shadowStackHead;
        /* Initialize the object tree with window as the root object*/
        ObjectToId.set(rootObject,0);
        ObjectTree[0] = {};


        var appendObjectTree = function(rootId, key, childId){
            var _edge = ObjectTree[rootId];
            if (typeof key == "symbol")
                var ekey = "e_" + key.toString();
            else var ekey = "e_" + key;
            if (_edge) {
                if (!_edge[ekey])
                    _edge[ekey] = [];
                if (_edge[ekey].indexOf(childId)<0)
                    _edge[ekey].push(childId);
            }
            else {
                ObjectTree[rootId]  = {};
                var edge = ObjectTree[rootId];
                edge[ekey] = [];
                edge[ekey].push(childId);
            }
        }

        var stateAlreadyLogged = function(nodeId, logTup, logType){
            var otherLogType = logType.indexOf("reads")>=0 ? rootType+"_writes" : rootType +"_reads";
            var stateLogged = false;
            if (logType.indexOf("reads")>=0){
                //Test whether the value read is written inside the current function itself
                if (customLocalStorage[nodeId][otherLogType]) {
                    customLocalStorage[nodeId][otherLogType].forEach((el)=>{
                        if (el[0] == logTup[0] && el[1] == logTup[1])
                            stateLogged = true;
                    });
                    if (stateLogged) return stateLogged;
                }
            }

            customLocalStorage[nodeId][logType].forEach((tupEntry)=>{
                if (JSON.stringify(tupEntry) == JSON.stringify(logTup))
                    stateLogged = true;
            })
            return stateLogged;
        }

        var hasObjectId = function(obj){
            return ObjectToId.get(obj);
        }

        var getObjectId = function(obj){
            var rootId = ObjectToId.get(obj);
            if (rootId != null) return rootId;
            rootId = objectIdCounter;
            objectIdCounter++;
            ObjectToId.set(obj, rootId);
            return rootId;
        }

        var loggerFunction = function(target, key, value, logType){
            if (key == "__isProxy" || key == "top" || key == "parent" || document.readyState == "complete") return;
            // if ( value && value.self == value) return;
            if (value && value.__isProxy)
                value = value.__target;
            var nodeId = _shadowStackHead ? _shadowStackHead : null;
            // var nodeId = _nodeId + "_count" + invocationsIndName[_nodeId];
            //TODO only storing signature of the first invocation and not including the signature of future 
            //invocations. 
            if ( (!nodeId && logType.indexOf("global")<0 ) || (nodeId && 
                (functionsSeen.indexOf(nodeId) >= 0 || nonCacheableNodes[nodeId] || exceedsInvocationLimit(nodeId))) ) return;

            if (logType.indexOf("argument")>=0 || logType.indexOf("this")>=0 || logType.indexOf("closure")>=0)
                nodeId = parentFunctionId;

            var rootId = getObjectId(target);
            //This check implies that the function where the proxy is being accessed
            // is different from where it was created
            // therefore, add the log in both function signatures
            var currentObjectTree = null;
            var remoteLogType = "";
            if (_shadowStackHead != nodeId) {
                //Check how in the current function, it is being accessed: as closure,argument, or this
                if ( invocationToArgProxy[_shadowStackHead] ){
                    var remotePrivates = invocationToArgProxy[_shadowStackHead].accessToPrivates();
                    if (remotePrivates.hasObjectId(target)) {
                        currentObjectTree = remotePrivates.getObjectId;
                        var remoteRootId = currentObjectTree(target);
                        remoteLogType += "argument_" + logType.split('_')[1];
                    }
                } 
                if (!currentObjectTree && invocationToClosureProxy[_shadowStackHead]) {
                    var remotePrivates = invocationToClosureProxy[_shadowStackHead].accessToPrivates();
                    if (remotePrivates.hasObjectId(target)) {
                        currentObjectTree = remotePrivates.getObjectId;
                        var remoteRootId = currentObjectTree(target);
                        remoteLogType += "closure_" + logType.split('_')[1];
                    }
                }
                if (!currentObjectTree && invocationToThisProxy[_shadowStackHead]){
                    var remotePrivates = invocationToThisProxy[_shadowStackHead].accessToPrivates();
                    if (remotePrivates.hasObjectId(target)) {
                        currentObjectTree = remotePrivates.getObjectId;
                        var remoteRootId = currentObjectTree(target);
                        remoteLogType += "this_" + logType.split('_')[1];
                    }
                }
            }
            
            if (value instanceof Object || (typeof value == "object" && value != null)) {
                var childId = getObjectId(value);
            
                // Only add to tree if the value is type object
                appendObjectTree(rootId, key, childId);
                if (currentObjectTree) {
                    var remoteChildId = currentObjectTree(value);
                    remotePrivates.appendObjectTree(remoteRootId, key, remoteChildId);
                }
                // Only read argument reads if they are primitives, ie the next else condition
                if (logType == "argument_reads" && rootId == 0 ) return;
                if (logType == "closure_reads" && rootId == 0 ) return;
            } else {
                if (typeof value == "symbol")
                    var childId = 'p-'  + value.toString();
                else var childId = 'p-' + value;
            }

            if (typeof value == "undefined" && logType == "argument_reads" && rootId == 0) return;
               
            // The only time when not having a nodeId is allowed, is when the logger function is closed for a 
            // global read or write. However since the nodeId is not there, we won't be adding to any signature
            //only appending the object in the tree. 
            if (!nodeId) return;

            //Let's only store the child id and not worry about stringifying reads/writes
            var childLogStr = stringify(value);
            if (childLogStr && childLogStr.__proto__.__proto__ == "Error"){
                nonCacheableNodes[nodeId.split("_count")[0]] = "circular";
                return;
            } else if (!childLogStr && logType.indexOf("reads")>=0)
                return;

            // if (!stateAlreadyLogged(nodeId, [rootId, key, childLogStr], logType))
            customLocalStorage[nodeId][logType].push([rootId, key, childLogStr]);
            if (currentObjectTree) {
                // customLocalStorage[_shadowStackHead][remoteLogType].push([remoteRootId, key, childId]);
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

        // use hacks to detect if a method is a DOM object or not 
        // as sometimes even document objets are not instances of these parent objects
        // for reasons unknown
        // Despite window satisfying this criteria have this function return false for window
        // object specifically
        var isDOMInheritedProperty = function(method){
            return (method instanceof EventTarget || method instanceof HTMLCollection || method instanceof NodeList || method.readState
                || method.click) /*&& (method && method.self != method)*/
        }

        var outOfScopeProperties = ["location", "body", "Promise", "top", "parent", "prototype", "__proto__","toJSON", "self"];

        var isWindow = function(obj){
            if (obj && obj.self == obj){
                var proxyPrivates = globalProxyHandler.accessToPrivates();
                var _proxyMethod = proxyPrivates.methodToProxy.get(obj);
                if (_proxyMethod) return _proxyMethod;
                var proxyMethod = new Proxy(obj, handler);
                proxyPrivates.methodToProxy.set(obj, proxyMethod);
                return proxyMethod;
            }
        }

        var handler = {
          get(target, key, receiver) {

            if (key == "__isProxy") return rootType;
            if (key == "__target") return target;
            if (key == "__debug") return parentFunctionId;
            
            var method = Reflect.get(target,key);

            var isWinObj;
            if (isWinObj = isWindow(method))


            if (outOfScopeProperties.includes(key)) return method;

            loggerFunction(target, key, method, rootType + "_reads");

            if (method && method.__isProxy) {
                if (rootType == "global" || method.__isProxy == "global") 
                    return method;
                method = method.__target;
                // Sometimes the toString method doesn't exist on certain objects
                // if (Object.prototype.toString.call(target).indexOf("Arguments")>=0)
                //     return method;
                //     var actualMethod = method.__target;
                //     var childId = getObjectId(actualMethod);
                //     appendObjectTree(0, key, childId, ObjectTree);
                // } else if (target.__isClosureProxy) {
                //     var actualMethod = method.__target;
                //     var childId = getObjectId(actualMethod);
                //     appendObjectTree(0, key, childId, ObjectTree);
                
                // return method;
            }
            /* If method type if function, don't wrap in proxy for now */
            if (method && (typeof method === 'object' || typeof method=== "function") && !outOfScopeProperties.includes(key) && !isDOMInheritedProperty(method)) {
              var desc = customMethods.getOwnPropertyDescriptor(target, key);
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
              // var proxyHandler = rootType == "global"  ? handler : _shadowStackHead ? invocationToProxy[_shadowStackHead][1] : handler;
              var proxyMethod = new Proxy(method, handler);
              methodToProxy.set(method, proxyMethod);
              return proxyMethod;
            } else {
              return method;
            }
          },
          set (target, key, value, receiver) {
            loggerFunction(target, key, value,rootType + "_writes");
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
                if (Reflect.apply.__isProxy)
                    Reflect.apply = Reflect.apply.__target;
                if (!thisArg) return Reflect.apply(target, thisArg, args);
                else if (!thisArg.__isProxy)
                 return Reflect.apply(target, thisArg, args);
                else return Reflect.apply(target, thisArg.__target, args);
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
          },
          accessToPrivates (){
            return {ObjectTree: ObjectTree,getObjectId:getObjectId, appendObjectTree:appendObjectTree, hasObjectId:hasObjectId,
                    methodToProxy:methodToProxy}
          },

          getProcessedSignature (){
            var sigProcessor = new SignatureProcessor();
            sigProcessor.process();
            sigProcessor.postProcess();

            // // //Commenting out signature propogation for now
            // // //TODO
            sigProcessor.signaturePropogate();
            return sigProcessor.processedSig;
          }

        }

        return handler;
    }

    var globalProxyHandler = proxyEncapsulation(window,"global");

    var {proxy, revoke} = Proxy.revocable(window, globalProxyHandler);
    // Flag to disable proxy
    window.{proxyName} = proxy;
    // window.{proxyName} = window;
    globalProxyHandler.accessToPrivates().methodToProxy.set(window, proxy);

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

    this.getInvocationProperties = function() {
        return nodesByProperties;
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

    this.isProxy = function(obj){
        if (!obj || (typeof obj != "function" && typeof obj !="object")) return obj;
        if (obj.self == obj) return obj;
        if (obj.__isProxy) return obj.__target
        else return obj;
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

    this.logReturnValue = function(functionIdentifier, returnValue, params) {
        this.exitFunction(functionIdentifier, params);
        if (pageRecorded) return returnValue;
        if (functionsSeen.indexOf(functionIdentifier) >= 0 || exceedsInvocationLimit(functionIdentifier) ) return returnValue;
        // return returnValue;
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
        if (returnValue && returnValue.__debug && returnValue.__debug != "global")
            return returnValue.__target;
        else return returnValue;
    }

    var logNonProxyParams = function(nodeId,params){
        for(var i in params) {
                if (params[i] != null && !params[i].__isProxy && typeof params[i] != "function")
                    var strParam =  stringify(params[i]);
                 if (strParam && strParam.__proto__.__proto__ == "Error") return
                 customLocalStorage[nodeId].arguments.before[i] = strParam;
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

    var exceedsInvocationLimit = function(nodeId){
        return nodeId.split("_count")[1] > INVOCATION_LIMIT;
    }

    this.cacheInit = function(nodeId, params){
        if (invocationsIndName[nodeId] != null)
            invocationsIndName[nodeId]++;
        else invocationsIndName[nodeId] = 0;

        var cacheIndex = nodeId + "_count" + invocationsIndName[nodeId];

        if (!callGraph[cacheIndex])
            callGraph[cacheIndex] = [];

        // if (nonCacheableNodes[nodeId]) {
        //     return false;
        // }

        // if (nodesByProperties["ND"].indexOf(nodeId)>=0)
        //     nodesByProperties["ND"].push(cacheIndex);
        // else if (nodesByProperties["RTI"].indexOf(nodeId)>=0)
        //     nodesByProperties["RTI"].push(cacheIndex);
        // else if (nodesByProperties["DOM"].indexOf(nodeId)>=0)
        //     nodesByProperties["DOM"].push(cacheIndex);
         // if (nodesByProperties["antiLocal"].indexOf(nodeId)>=0)
         //    nodesByProperties["antiLocal"].push(cacheIndex);

        /*
        * The following snippet analyses the 
        * type of functions based on their arguments
        * data type
        */
        
        let key = nodeId;
        const delim = ';;';
        var _sig = getArgTypes(params,delim);

        // if (_sig.indexOf("function") >= 0 ) {
        //     nonCacheableNodes[nodeId] = "arg";
        //     return false;
        // }

        // key +=  delim + params.length + delim + _sig;

        // if (invocations[key])
        //     invocations[key]++;
        // else invocations[key] = 1;
        

        if (_shadowStackHead) {
            callGraph[_shadowStackHead].push(cacheIndex)
            // nonCacheableNodes[nodeId] = "callee";
        }

        shadowStack.push(cacheIndex);
        _shadowStackHead = cacheIndex;

        if (invocationsIndName[nodeId] > INVOCATION_LIMIT)
            return;

        if (customLocalStorage[cacheIndex])
            console.error("Same function with same invocation id", cacheIndex);

        customLocalStorage[cacheIndex] = {}
        customLocalStorage[cacheIndex]["global_writes"] = [];
        customLocalStorage[cacheIndex]["global_reads"] = [];
        customLocalStorage[cacheIndex]["argument_reads"] = [];
        customLocalStorage[cacheIndex]["argument_writes"] = [];
        customLocalStorage[cacheIndex]["this_reads"] = [];
        customLocalStorage[cacheIndex]["this_writes"] = [];
        customLocalStorage[cacheIndex]["closure_reads"] = [];
        customLocalStorage[cacheIndex]["closure_writes"] = [];
        if (params && params.length != 0) {
            // customLocalStorage[cacheIndex]["arguments"] = {}
            // customLocalStorage[cacheIndex]["arguments"]["before"] = {};
            // logNonProxyParams(cacheIndex, params);
            //Only for capturing the type of arguments:
            customLocalStorage[cacheIndex]["argProp"] = _sig;
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

        // if (invocationToArgProxy[cacheIndex])
        //     invocationToArgProxy[cacheIndex][1] = invocationToArgProxy[cacheIndex][]
    }

    this.dumpArguments = function(nodeId, params) {
        // functionTimerE[nodeId] = performance.now();
        // window.sigStack[nodeId].push(functionTimerE[nodeId] - functionTimerS[nodeId]);
        // return;
        if (customLocalStorage[nodeId]["arguments"])
            customLocalStorage[nodeId]["arguments"]["after"] = params;
        shadowStack.pop();
    }

    this.createArgumentProxy = function(argObj){
        if (pageLoaded) return argObj;
        var nodeId = _shadowStackHead ? _shadowStackHead : null;
        if (!nodeId || (nodeId && (nonCacheableNodes[nodeId] || exceedsInvocationLimit(nodeId) ))) return argObj;
        if (!argObj.length) return argObj;
        if (argObj.__isProxy) argObj = argObj.__target;
        var proxyHandler = proxyEncapsulation(argObj,"argument");
        var argProxy = new Proxy(argObj, proxyHandler);
        // proxyHandler.accessToPrivates().proxyToMethod.set(argProxy, argObj);
        if (invocationToArgProxy[nodeId]) console.error("invocation already has a previous proxy");
        invocationToArgProxy[nodeId] = proxyHandler;
        return argProxy
    }

    this.createClosureProxy = function(closureObj){
        if (pageLoaded) return closureObj;
        var nodeId = _shadowStackHead ? _shadowStackHead : null;
        if (!nodeId || (nodeId && (nonCacheableNodes[nodeId] || exceedsInvocationLimit(nodeId) ) ) ) return closureObj;
        if (!Object.keys(closureObj).length) return closureObj;
        if (closureObj.__isProxy) closureObj = closureObj.__target;
        var proxyHandler = proxyEncapsulation(closureObj,"closure");
        var closureProxy = new Proxy(closureObj, proxyHandler);
        // proxyHandler.accessToPrivates().proxyToMethod.set(closureProxy, closureObj);
        invocationToClosureProxy[nodeId] = proxyHandler;
        return closureProxy;
    }

    /*
    thisProxy is separate from argument Proxy, as the target object itself could
    be a proxy object, and we don't want to wrap a proxy on top a proxy
    therefore, first we check if it already is a proxy and get rid of it, before wrapping
    it up in a proxy. 
    */
    this.createThisProxy = function(thisObj){
        if (pageLoaded || !thisObj || (typeof thisObj != "function" && typeof thisObj != "object")) return thisObj;
        var nodeId = _shadowStackHead ? _shadowStackHead : null;
        if (!nodeId || (nodeId && (functionsSeen.indexOf(nodeId) >= 0 || nonCacheableNodes[nodeId]) || exceedsInvocationLimit(nodeId) ) ) return thisObj;
        if (thisObj.__isProxy) thisObj = thisObj.__target;
        var proxyHandler = proxyEncapsulation(thisObj,"this");
        var thisProxy = new Proxy(thisObj, proxyHandler);
        // proxyHandler.accessToPrivates().proxyToMethod.set(thisProxy, thisObj);
        if (invocationToThisProxy[nodeId]) console.error("invocation already has a previous proxy");
        invocationToThisProxy[nodeId] =   proxyHandler;
        return thisProxy;
    }

    var escapeRegExp = function(str) {
        return str.replace(/[\"]/g, "\\$&");
    }

    var isNative = function(fn) {
        return (/\{\s*\[native code\]\s*\}/).test('' + fn);
    }

    function stringify(obj) {
        try {
            return JSON.stringify(obj, function (key, value) {
              if (value && value.__isProxy)
                    value = value.__target;
              var fnBody;
              if (value instanceof Function || typeof value == 'function') {

                if ((/\{\s*\[native code\]\s*\}/).test(value.toString())) {
                    return value.name;
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
        } catch(e){
            return e;
        }
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

    class SignatureProcessor{

            //ptype - specifies the type of processing to do, by pointing to the node
            constructor(signature, ObjectTree, callGraph, pType){
                this.signature = signature;
                this.objectTree = ObjectTree;
                this.processedSig = {};
                this.objectToPathPerOT = {"this":{}};
                this.callGraph = callGraph;
                this.logType = pType;
            }

            process(){
                var objectToPathPerOT = this.objectToPathPerOT;
                var objectTreeThis = this.objectTree;
                var signature = this.signature;
                var processedSig = this.processedSig;
                var reverseObjectToId = {};
                var logType = this.logType;
                var callGraph = this.callGraph;

                var init = function(){
                    switch(logType){
                        case  "global" :
                            objectToPathPerOT.this[0] = "window";
                            break;
                        case "argument" :
                            objectToPathPerOT.this[0] = "arguments"
                            break;
                        case "closure":
                            objectToPathPerOT.this[0] = "closure"
                            break;
                        case "this" :
                            objectToPathPerOT.this[0] = "this";
                            break;
                    }
                }

                var stringify = function (obj) {

                    return JSON.stringify(obj, function (key, value) {
                      if (value.__isProxy)
                        value = value.__target;
                      var fnBody;
                      if (value instanceof Function || typeof value == 'function') {
                        return value.toString();

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

                var constructPath = function(objectId, OT="this"){
                    if (!objectToPathPerOT[OT]) objectToPathPerOT[OT] = {0:"arguments"};
                    if (objectToPathPerOT[OT][objectId]) return objectToPathPerOT[OT][objectId];
                    var path = "";
                    var objectTree = OT == "this" ? objectTreeThis : invocationToArgProxy[OT].accessToPrivates().ObjectTree;
                    for (var nodeId in objectTree){
                        for (var edge in objectTree[nodeId]) {
                            var _id = objectTree[nodeId][edge].indexOf(objectId);
                            if (_id) {
                                var parentPath = constructPath(nodeId, OT);
                                path = parentPath + "['" + edge.substr(2) + "']";
                                objectToPathPerOT[OT][objectId] = path;
                                return path;
                            }
                        }
                    }
                    // console.error("NO PATH FOUND FOR OBJECT ID: " + objectId);
                }

                var reverseLookup = function(objectId) {
                    if (reverseObjectToId[objectId]) return reverseObjectToId[objectId];

                }

                var preProcess = function(OT){
                    var objectTree = OT == "this" ? objectTreeThis : invocationToArgProxy[OT].accessToPrivates().ObjectTree;
                    for (var nodeId in objectTree) {
                        var parentPath = constructPath(nodeId, OT);
                        // if (!parentPath) console.error("NO PARENT PATH FOUND WHILE PREPROCESSING " + nodeId );
                        for (var edge in objectTree[nodeId]) {
                            objectTree[nodeId][edge].forEach(function(objectId){
                                 if (!objectToPathPerOT.this[objectId]) {
                                    var path = parentPath + "['" + edge.substr(2) + "']";
                                    objectToPathPerOT.this[objectId] = path;
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
                    var readArray = signature[nodeId][logType+"_reads"];
                    processedSig[nodeId][logType+"_reads"] = [];
                    readArray.forEach(function(read){
                        var OT = "this"
                        if (OT != "this")
                            preProcess(OT);
                        var parentPath = objectToPathPerOT[OT][read[0]]
                        // if (!parentPath) console.log("no parent path found for object id:" + JSON.stringify(read) + " " + nodeId);
                        try {
                            var readString;
                            if (typeof read[1] == 'symbol')
                                readString = read[1].toString()
                            else readString = read[1] + '';
                            var path = parentPath + "['" + readString + "']";
                            var readVal = read[2];
                            readSignature = path + " = " + readVal;
                        } catch (e) {
                            //TODO
                            //suppressing for now
                            //SUPPRESS
                            // console.log("Error while trying to stringify path: " + e + e.stack);
                        }
                        if (readSignature) {
                            if (detectProperty(readVal)) processedSig[nodeId].isFunction = true;
                            processedSig[nodeId][logType+"_reads"].push(readSignature);
                        }
                    })
                }

                var processWrite = function(nodeId){
                    var writeSignature;
                    var writeArray = signature[nodeId][logType+"_writes"];
                    processedSig[nodeId][logType+"_writes"] = [];
                    writeArray.forEach(function(write){
                        var OT = "this"
                        if (OT != "this")
                            preProcess(OT);
                        var parentPath = objectToPathPerOT[OT][write[0]];
                        if (!parentPath) console.log("no parent path found for object id:" + JSON.stringify(write) + " " + nodeId);
                        var path = parentPath + "['" + write[1] + "']"; 
                        try {
                            var writeVal = write[2];
                            writeSignature = path + " = " + writeVal;
                        } catch (e) {
                            //TODO
                            //suppressing for now
                            //SUPPRESS
                            // console.log("Error while stringifying path: " + e + e.stack);
                        }
                        if (writeSignature) {
                            if (detectProperty(writeVal)) processedSig[nodeId].isFunction = true;
                            processedSig[nodeId][logType+"_writes"].push(writeSignature);
                        }
                    })

                }

                //Generic function to detect a specific property of the signature
                var detectProperty = function(obj, property="function"){
                    if (typeof obj == "string")
                        return obj.split(';;').indexOf(property) >=0;
                    else if (typeof obj == property) return true;
                    else return false;
                }


                init();
                preProcess("this");
                //cleanup signatures ie remove a read after write
                // removeReduntantReads();

                Object.keys(this.signature).forEach(function(nodeId){
                    // Return if not leaf node
                    if (trackOnlyLeaf &&  callGraph[nodeId].length) return;
                    processedSig[nodeId] = {};
                    if (signature[nodeId][logType+"_reads"] && signature[nodeId][logType+"_reads"].length)
                        processRead(nodeId)
                    if (signature[nodeId][logType+"_writes"] && signature[nodeId][[logType+"_writes"]].length)
                        processWrite(nodeId)
                    Object.keys(signature[nodeId]).forEach((key)=>{
                        if (!processedSig[nodeId][key]) {
                            if (detectProperty(signature[nodeId][key])) processedSig[nodeId].isFunction = true;
                            processedSig[nodeId][key] = signature[nodeId][key];
                        }
                    })
                });

            }

            postProcess() {
                var processedSig = this.processedSig;
                var callGraph = this.callGraph;
                var logType = this.logType;
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
                    var readArray = processedSig[nodeId][logType+"_reads"];
                    var keys = readArray.map(key => key.split('=')[0].trim());
                    var redundantIndices = _removeRedundantReads(keys);
                    for (var index = redundantIndices.length-1; index >= 0; index--)
                        readArray.splice(redundantIndices[index],1);
                    // redundantIndices.forEach(index => {
                    //     readArray.splice(index, 1);
                    // });
                }

                Object.keys(processedSig).forEach(function(nodeId){
                    if (trackOnlyLeaf && callGraph[nodeId].length) return;
                    if (processedSig[nodeId][logType+"_reads"])
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
                var logType = this.logType;
                var mergeArray = function(dstSig, srcSig) {
                    srcSig.forEach((sig) => {
                        if (dstSig.indexOf(sig) < 0)
                            dstSig.push(sig);
                    });
                }

                var mergeInto = function(dstNode, srcNode) {
                    if (processedSig[srcNode] && processedSig[srcNode].isFunction)
                        processedSig[dstNode].isFunction = true;
                    if (processedSig[srcNode] && processedSig[srcNode][logType+"_reads"]) {
                        if (processedSig[dstNode] && !processedSig[dstNode][logType+"_reads"]) 
                            processedSig[dstNode][logType+"_reads"] = [];
                        mergeArray(processedSig[dstNode][logType+"_reads"], processedSig[srcNode][logType+"_reads"]);
                    }

                    if (processedSig[srcNode] && processedSig[srcNode][logType+"_writes"]) {
                        if (processedSig[dstNode] && !processedSig[dstNode][logType+"_writes"] ) 
                            processedSig[dstNode][logType+"_writes"] = [];
                        mergeArray(processedSig[dstNode][logType+"_writes"], processedSig[srcNode][logType+"_writes"]);
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

});

}
(function () { {name}.setGlobal(this); })();