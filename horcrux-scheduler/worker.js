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


self.addEventListener('message', (event) => {
    console.log(`Worker received ${JSON.stringify(event.data)}`);
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
            // TODO: send errorMsg back to main
            return;
        }
        const funcStart = Date.now();
        // initialize window var in the worker's global scope
        self.window = JSON.parse(event.data.window, functionReviver);
        console.log(`worker global scope: ${JSON.stringify(self.window)}`);
        const reconstructed = new Function(fnArgs, fnBody);
        reconstructed();
        const runtime = Date.now() - funcStart;
        self.postMessage({
            'status': 'executed',
            'id': workerId,
            'window': JSON.stringify(self.window, functionStringifier),
            'runtime': runtime,
        });
    }
});
