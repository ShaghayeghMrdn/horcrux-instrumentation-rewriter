const webWorkerScriptID = '__horcrux_worker__';

/**
 * defines the __callScheduler__ function globally
 * Initializes the related fields including: list of available workers,
 * Horcrux special event queue, ...
 */
function __defineScheduler__() {
    // List of available workers
    this.availableWorker = [];

    /** Wakes up the main scheduler to handle:
     * case 1: TODO
     * case 2: when a function wanted to be invoked inside <script>
     * -- This function is defined as a property of window so that
     * it can be called from inside rewritten IIFE and async functions.
     * @param {string} fnBody stringified function body, sent to constrcutor
     * @param {Array} fnSignature list of function dependencies
     */
    window.__callScheduler__ = function(fnBody, fnSignature) {
        const fnArgs = '';
        // prepare the input arguments for the fnBody using the signature
        fnSignature.forEach((dependency) => {
            if (dependency[0].startsWith('closure')) {
                console.error('Cannot handle:', dependency);
            } else if (!dependency[0].startsWith('global')) {
                console.log('Besides global and cloure:', dependency);
            }
            // no action is needed, if it's a global depedendency
        });
        console.log('LOG: fnArgs:"' + fnArgs + '"');
        const reconstructed = new Function(fnArgs, fnBody);
        reconstructed();
    };

    /**
     * Main thread 'message' event handler.
     * @param {event} event Received message from worker in .data property
     */
    function mainThreadListener(event) {
        console.log(`Main received: ${JSON.stringify(event.data)}`);
        if (event.data.status == 'setup') {
            const setupTime = event.data.ts - setupStart;
            console.log(`worker setup time: ${setupTime}`);
        } else if (event.data.status == 'executed') {
            const inputTime = event.data.inputReceived - inputStart;
            const runtime = event.data.runtime;
            console.log(`input time: ${inputTime}, runtime: ${runtime}`);
        }
    }

    const setupStart = Date.now();
    let inputStart;
    const blob = new Blob([
        document.getElementById(webWorkerScriptID).textContent,
    ], {
        type: 'text/javascript',
    });
    const worker = new Worker(window.URL.createObjectURL(blob));
    worker.addEventListener('message', mainThreadListener);
};

if (typeof __scheduler__ === 'undefined') {
    __scheduler__ = new __defineScheduler__();
}

