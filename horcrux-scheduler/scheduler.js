const webWorkerScriptID = '__horcrux_worker__';
const numOfWorkers = 2;

/**
 * defines the __callScheduler__ function globally which acts as wake up call.
 * sets up a number of workers, and adds them to the list of available workers.
 */
function __defineScheduler__() {
    // List of all workers
    const workers = [];
    // List of available workers
    const availableWorkers = [];
    setUpWorkers();
    // Horcrux special event queue: holds functions in order to be executed
    const horcruxQueue = [];
    /** Map from closure def location to defined variables in that location.
     * value is a dictionary of variable names to their corresponding values
     * @type {Object.<string, Object.<string, Object>>}
     */
    const closureMap = new Map();

    /** Checks if the two given functions have dependency conflicts.
     * Two functions have dependency conflicts if both of them are sharing
     * access to one variable and one of the accesses is write (e.g., R-W,
     * W-R, W-W). There is not a dependency conflict if both of functions are
     * just reading the variable.
     * @param {Array} candidateSignature
     * @param {Array} otherSignature
     * @return {boolean} returns true if there is any conflict
     */
    function _hasConflict(candidateSignature, otherSignature) {
        let conflict = false;
        for (let i = 0; i < candidateSignature.length; ++i) {
            const candidateDep = candidateSignature[i];
            const lastIndex = candidateDep[0].lastIndexOf('_');
            const scope = candidateDep[0].substring(0, lastIndex);
            const readWrite = candidateDep[0].substring(lastIndex+1);
            for (let j = 0; j < otherSignature.length; ++j) {
                const otherDep = otherSignature[j];
                const otherLastIndex = otherDep[0].lastIndexOf('_');
                if (scope !== otherDep[0].substring(0, otherLastIndex)) {
                    continue;
                }
                const otherReadWrite = otherDep[0].substring(otherLastIndex+1);
                if (readWrite === 'reads' && otherReadWrite === 'reads') {
                    continue;
                }
                if (candidateDep[1].includes(otherDep[1]) ||
                    otherDep[1].includes(candidateDep[1])) {
                    conflict = true;
                    break;
                }
            }
            if (conflict) {
                break;
            }
        }
        return conflict;
    }

    /** Makes sure the given candidate function does not have any dependency
     * conflicts with either any of the functions running on the web workers
     * or the ones ahead of it in the queue.
     * @param {Object.<index, fnBody, fnSignature, touchDOM>} candidate
     * @return {boolean} returns false if candidate has any dependency conflict
     */
    function _safeToExecute(candidate) {
        let safe = true;
        // first check the already offloaded functions
        for (let i = 0; i < workers.length; ++i) {
            if (workers[i].executing &&
                _hasConflict(candidate.fnSignature, workers[i].signature)) {
                safe = false;
                break;
            }
        }
        if (!safe) {
            return false;
        }
        for (let i = 0; i < horcruxQueue.length; ++i) {
            if (horcruxQueue[i] == candidate) {
                // found itself; Have checked all functions ahead of it
                break;
            }
            if (_hasConflict(candidate.fnSignature,
                horcruxQueue[i].fnSignature)) {
                safe = false;
                break;
            }
        }
        return safe;
    }


    /** Wakes up the scheduler to execute the next function in the queue
     * Gets called when either the worker or the main thread has finished
     * executing the previous function.
     */
    function executeNextFunction() {
        if (horcruxQueue.length == 0) {
            return;
        }
        let domPause = false;
        if (availableWorkers.length > 0 && !domPause) {
            let qindex = 0;
            while (qindex < horcruxQueue.length) {
                const candidate = horcruxQueue[qindex];
                if (candidate.touchDOM) {
                    domPause = true;
                    break;
                } else {
                    if (_safeToExecute(candidate)) {
                        // found a candidate
                        break;
                    }
                }
                qindex += 1;
            }
            if (!domPause) {
                if (qindex !== horcruxQueue.length) {
                    // no DOM in queue and found a candidate that is safe
                    // take qindex-th item out of queue, returns array of size 1
                    const candidate = horcruxQueue.splice(qindex, 1);
                    const worker = availableWorkers.shift();
                    offloadToWorker(worker,
                        candidate[0].index,
                        candidate[0].fnBody,
                        candidate[0].fnSignature);
                }
            } else if (domPause && qindex == 0) {
                // if the head of queue is touching dom
                if (_safeToExecute(horcruxQueue[qindex])) {
                    // and has no conflict with the ones executing on workers
                    const head = horcruxQueue.shift();
                    domPause = false;
                    executeOnMain(head.index, head.fnBody, head.fnSignature);
                } else {
                    // cannot execute yet, has to wait on some worker to finish
                    // console.log('DOM pause! Has to wait for worker to finish');
                    return;
                }
            } else {
                // console.log('DOM pause! Has to wait for others to finish');
                return;
            }
        }
    }

    /** Gets called from inside a rewritten IIFE (<script>).
     * It adds the function to Horcrux queue and delegates the offloading
     * decision to scheduler wake-up call!
     * @see executeNextFunction.
     * -- This function is defined as a property of window so that
     * it can be called from inside rewritten IIFE and async functions.
     * @param {string} index location of function that invoked callScheduler
     * @param {string} fnBody stringified function body, sent to constructor
     * @param {Array} fnSignature list of function dependencies
     * @param {boolean} touchDOM whether the to-be function is accessing DOM
     */
    window.__callScheduler__ = function(index, fnBody, fnSignature, touchDOM) {
        // Shorthand property names -- e.g., {a:a, b:b, c:c}
        horcruxQueue.push({index, fnBody, fnSignature, touchDOM});
        // call executeNextFunction since there might be an idle worker waiting
        // and none of the previously present functions could be offloaded to it
        executeNextFunction();
    };

    /** Helper function for JSON stringify when the value is a function
     * @param {string} key
     * @param {string} value
     * @return {string} stringified value
     */
    function functionStringifier(key, value) {
        if (typeof(value) === 'function') {
            return value.toString();
        }
        return value;
    }

    /** Helper function for JSON parse when the value is a function
     * @param {string} key
     * @param {string} value
     * @return {string} stringified functions is reconstructed as functions
     */
    function functionReviver(key, value) {
        if (typeof value === 'string') {
            const rfunc = /function[^\(]*\(([^\)]*)\)[^\{]*\{([\s\S]*)\}/;
            const match = value.match(rfunc);
            if (match) {
                const args = match[1].split(',').map(function(arg) {
                    return arg.replace(/\s+/, '');
                });
                return new Function(args, match[2]);
            }
        }
        return value;
    }

    /** Offloads a function to a web worker using postMessage
     * @param {Object} worker wrapper around actual worker object
     * @param {string} index original function location
     * @param {string} fnBody stringified function body to be offloaded
     * @param {Array} fnSignature list of function dependencies
     */
    function offloadToWorker(worker, index, fnBody, fnSignature) {
        const fnArgs = [];
        const windowClone = {};
        const inputValues = [];
        /** a dictionary of closure definition location to closure variables
         * defined in that location and updated in the worker
         * @type{Object.<string, string[]>}
         */
        const outputValues = {};
        // prepare the input arguments for the fnBody using the signature
        fnSignature.forEach((dependency) => {
            // should not split using '_', since the function location might
            // contain '_'. Instead use the first and last underline
            const firstUnder = dependency[0].indexOf('_');
            const lastUnder = dependency[0].lastIndexOf('_');
            const scope = dependency[0].slice(0, firstUnder);
            const location = dependency[0].slice(firstUnder, lastUnder);
            const access = dependency[0].slice(lastUnder);
            const name = dependency[1].substring(4); // removes ';;;;'
            if (scope == 'global') {
                handleGlobalDependency(access, name);
            } else if (scope == 'closure') {
                if (location != "") {
                    const value = (access == 'reads') ? dependency[2] : '';
                    handleClosureDependency(location, access, name, value);
                }
            }
        });
        worker.signature = fnSignature;
        worker.executing = true;
        // console.log(`Offloading ${index} to worker`);
        worker.workerObj.postMessage({
            'cmd': 'execute',
            'fnBody': fnBody,
            'fnArgs': fnArgs.toString(),
            'window': JSON.stringify(windowClone, functionStringifier),
            'inputValues': inputValues,
            'outputValues': outputValues,
        });

        /* private helper functions for handling dependencies */
        /**
         * @param {string} access 'reads' or 'writes'
         * @param {string} name global variable name without window.
         */
        function handleGlobalDependency(access, name) {
            // for cases where window.name is accessed (read or write)
            // if window.name is undefined, it will not be passed to worker
            windowClone[name] = window[name];
        };

        /** Preparing closure dependencies to be passed to worker
         * @param {string} location of surrounding function that defines closure
         * @param {string} access 'reads' or 'writes'
         * @param {string} name closure variable name (might be path)
         * @param {string} value of the closure variable that is read
         */
        function handleClosureDependency(location, access, name, value) {
            if (access == 'reads') {
                // console.log(`reads closure ${name} = ${value}`);
                const nameParts = name.split(';;;;');
                if (nameParts.length == 1) {
                    const valueParts = value.split(';;&;;');
                    if (valueParts[1] == 'object' &&
                        valueParts[3] == 'Object') {
                        inputValues[name] = JSON.parse(valueParts[0]);
                        if (!closureMap.has(location)) {
                            closureMap.set(location, {name: inputValues[name]});
                        } else {
                            // just double-checking the values in closureMap
                            const old = closureMap.get(location);
                        }
                    }
                }
            } else if (access == 'writes') {
                if (outputValues[location] === undefined) {
                    outputValues[location] = [];
                }
                outputValues[location].push(name);
            }
        };
    };

    /** Takes care of applying the worker updates/outputs to the main
     * @param {Object} workerWindow updated window in worker scope
     * @param {Object.<string, Object>} updatedClosures dictionary from
     * closure definition location to the updated closure variables
     */
    function applyWorkerUpdates(workerWindow, updatedClosures) {
        for (const name in workerWindow) {
            if (workerWindow[name] !== 'undefined') {
                window[name] = workerWindow[name];
            }
        }
        for (const location in updatedClosures) {
            if (closureMap.has(location)) {
                // TODO: should not set the whole object
                // if parts of object is sent from worker only those fields
                // need to be updated here
                closureMap.get(location);
                closureMap.set(location, updatedClosures[location]);
            }
        }
        // for (const [key, value] of closureMap.entries()) {
        //     console.log(`closureMap: ${key} = ${JSON.stringify(value)}`);
        // }
    };

    /** Main thread 'message' event handler.
     * @param {MessageEvent} event Received message from worker in event.data
     */
    function mainThreadListener(event) {
        // console.log(`Main received: ${JSON.stringify(event.data)}`);
        const workerId = event.data.id;
        if (workerId === 'undefined' || workerId >= numOfWorkers) {
            console.error('Error: web worker message does not indicate the id');
            return;
        }
        const worker = workers[workerId];
        if (event.data.status == 'ready') {
            const setupTime = event.data.setupDone - worker.setupStart;
            worker['setupTime'] = setupTime;
            availableWorkers.push(worker);
        } else if (event.data.status == 'executed') {
            const workerWindow = JSON.parse(event.data.window, functionReviver);
            applyWorkerUpdates(workerWindow, event.data.updated);
            // free up the worker and add it to available workers
            worker.signature = null;
            worker.executing = false;
            availableWorkers.push(worker);
        }
        // wake up the scheduler to continue
        executeNextFunction();
    }

    /**
     * Sets up numOfWorkers of workers using with the content of <script>
     * identified by webWorkerScriptID.
     */
    function setUpWorkers() {
        for (let workerId = 0; workerId < numOfWorkers; ++workerId) {
            const start = Date.now();
            const blob = new Blob([
                document.getElementById(webWorkerScriptID).textContent,
            ], {
                type: 'text/javascript',
            });
            const worker = new Worker(window.URL.createObjectURL(blob));
            worker.addEventListener('message', mainThreadListener);
            const workerInfo = {
                id: workerId,
                workerObj: worker,
                setupStart: start,
                executing: false,
                signature: null,
            };
            /* This message is not necessary to start the web worker, it
             has already started, but more importantly it tells the web worker
             its id. */
            worker.postMessage({'cmd': 'start', 'id': workerId});
            workers.push(workerInfo);
        }
    };

    /** Executes the given function here (on the main thread) by reconstructing
     * it similar to how web workers do it.
     * Note: If there is a closure variable which was created/updated by workers
     * then must use the value tracked by closureMap.
     * To provide access to closure variables in the reconstructed function,
     * assign each closure variable to an input argument with the same name
     * Passing these values as input arguments should solve the problem.
     * @param {string} index
     * @param {string} fnBody
     * @param {Array} fnSignature
     */
    function executeOnMain(index, fnBody, fnSignature) {
        const fnArgs = '';
        fnSignature.forEach((dependency) => {
            // should not split using '_', since the function location might
            // contain '_'. Instead use the first and last underline
            const firstUnder = dependency[0].indexOf('_');
            const lastUnder = dependency[0].lastIndexOf('_');
            const scope = dependency[0].slice(0, firstUnder);
            const location = dependency[0].slice(firstUnder, lastUnder);
            const access = dependency[0].slice(lastUnder); // "reads"/"writes"
            const name = dependency[1].substring(4); // removes ';;;;'
            if (scope == 'closure') {
                // console.log('Running on main:', scopeAccess.length);
                const value = (access == 'reads') ? dependency[2] : '';
            }
        });

        // console.log(`Executing ${index} on main`);
        // reconstruct the function
        const reconstructed = new Function(fnArgs, fnBody);
        reconstructed();
        // then wake up the scheduler
        executeNextFunction();
    }
};

if (typeof __scheduler__ === 'undefined') {
    __scheduler__ = new __defineScheduler__();
}


//  LocalWords:  workerId workerInfo postMessage closureMap updatedClosures
//  LocalWords:  executeNextFunction
