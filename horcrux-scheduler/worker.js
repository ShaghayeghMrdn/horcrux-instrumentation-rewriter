const setupDone = Date.now();
// workerId is set through the 'start' cmd sent from main
// The worker should include its workerId in all of its messages to main
let workerId = 0;

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

/** Assign closure variables to worker scope as closure variables
 * @param {Array} inputValues
 */
function initializeClosures(inputValues) {
    for (const key in inputValues) {
        if (Object.prototype.hasOwnProperty.call(inputValues, key)) {
            self[key] = inputValues[key];
        }
    }
}

/** Copy updated closure variables to be sent back to main
 * @param {Object.<string, string[]>} outputValues
 * @return {Object.<string, Object>} a clone of updated closure variables
 */
function cloneClosures(outputValues) {
    const updated = {};
    Object.keys(outputValues).forEach((location) => {
        const updatedVars = outputValues[location];
        updated[location] = {};
        updatedVars.forEach((varName) => {
            const parts = varName.split(';;;;');
            // TODO: more efficient way would be to only send back the inner
            // field which is updated instead of the whole object
            updated[location][parts[0]] = self[parts[0]];
        });
    });
    return updated;
}


self.addEventListener('message', (event) => {
    // console.log(`Worker received ${JSON.stringify(event.data)}`);
    if (event.data.cmd == 'start') {
        workerId = event.data.id;
        // send a message to main thread to confirm setup is done
        self.postMessage({'status': 'ready',
            'id': workerId,
            'setupDone': setupDone});
    } else if (event.data.cmd == 'execute') {
        const fnBody = event.data.fnBody;
        const fnArgs = event.data.fnArgs;
        if (fnBody === 'undefined' || fnArgs === 'undefined') {
            const errorMsg = 'Error: function body or args are undefined';
            console.error(errorMsg);
            return;
        }
        const funcStart = Date.now();
        // initialize window var in the worker's global scope
        self.window = JSON.parse(event.data.window, functionReviver);
        // initialize the closure variables
        initializeClosures(event.data.inputValues);
        const reconstructed = new Function(fnArgs, fnBody);
        reconstructed();
        const updatedClosures = cloneClosures(event.data.outputValues);
        if (Object.keys(updatedClosures).length !== 0) {
            // console.log('Worker updated closures:', updatedClosures);
        }
        const runtime = Date.now() - funcStart;
        self.postMessage({
            'status': 'executed',
            'id': workerId,
            'window': JSON.stringify(self.window, functionStringifier),
            'updated': updatedClosures,
            'runtime': runtime,
        });
    }
});
