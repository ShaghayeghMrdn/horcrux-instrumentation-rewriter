const webWorkerScriptID = '__horcrux_worker__';
const numOfWorkers = 1;

/**
 * defines the __callScheduler__ function globally which acts as wake up call.
 * sets up a number of workers, and adds them to the list of available workers.
 * TODO: initialize Horcrux special event queue
 */
function __defineScheduler__() {
    // List of all workers
    const workers = [];
    // List of available workers
    const availableWorkers = [];
    setUpWorkers();

    /** Wakes up the main scheduler to handle:
     * case 1: TODO
     * case 2: when a function wanted to be invoked inside <script>
     * -- This function is defined as a property of window so that
     * it can be called from inside rewritten IIFE and async functions.
     * @param {string} fnBody stringified function body, sent to constructor
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
            // no action is needed, if it's a global dependency
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
            // TODO
            const setupTime = event.data.ts;
            console.log(`worker setup time: ${setupTime}`);
        }
        /*else if (event.data.status == 'executed') {
            const inputTime = event.data.inputReceived - inputStart;
            const runtime = event.data.runtime;
            console.log(`input time: ${inputTime}, runtime: ${runtime}`);
        }*/
    }

    /**
     * Sets up numOfWorkers of workers using with the content of <script>
     * identified by webWorkerScriptID.
     * @param {int} workerId
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
                assignedFunction: null,
                inputStart: null,
            };
            workers.push(workerInfo);
            availableWorkers.push(workerInfo);
        }
    };
};

if (typeof __scheduler__ === 'undefined') {
    __scheduler__ = new __defineScheduler__();
}


//  LocalWords:  workerId workerInfo
