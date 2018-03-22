

/*
The following script takes two invocations files from two separate web page replays and compares them
It compares the number of functions that were identical using the definition of the signature that we
have established:
signature: <functionId, arguments, returnValue, global changes to the environment>

*/

const fs = require('fs');

var invocation1 = [];
var invocation2 =[];

if (process.argv.length < 4){
    console.log("Usage: node compareWebPages.js <First list of invocations> <Second list of invocations");
    return;
}

function getUniqueInvocations(invocations){
    uniqueFunctions = [];
    invocations.forEach(function(entry){
        if (entry != null && uniqueFunctions.indexOf(entry.nodeId) < 0){
            uniqueFunctions.push(entry.nodeId);
        }
    });

    return uniqueFunctions;
}

function compareDictionaries(dict1, dict2){
    if (dict1 == undefined || dict2 == undefined) return false;

    console.log("Comparing the following dicts: " + JSON.stringify(dict1.After) + " and " + JSON.stringify(dict2.After))

    // for (var key1 in dict1.Before){
    //     var foundMatch = false;
    //     for (var key2 in dict2.Before){
    //         if (dict1.Before[key1] == dict2.Before[key2]){
    //             foundMatch = true;
    //             // console.log("Found match " + dict1.Before[key1] + " " + dict2.Before.key2);
    //             break;
    //         }
    //     }
    //     // console.log("Did we find a match: " + foundMatch)
    //     if (!foundMatch) {
    //         // console.log("The before keys didn't match")
    //         return false;
    //     }
    // }

    // SInce the before keys matched, moving onto matching the after keys:
    for (var key1 in dict1.After){
        var foundMatch = false;
        for (var key2 in dict2.After){
            if (key1 == key2 && JSON.stringify(dict1.After[key1]) == JSON.stringify(dict2.After[key2])){
                foundMatch = true;
                break;
            }
        }
        if (!foundMatch) {
            // console.log("The before keys didn't match")
            return false;
        }
    }
    console.log("Dicts completelly matched: " + JSON.stringify(dict1) + " \n " +  JSON.stringify(dict2))
    return true;
}
function compare(){
    console.log("Invocation1 has " + invocation1.length + " entries");
    console.log("Invocation2 has " + invocation2.length + " entries");

    var functionNamesMatched = 0;
    var matchFound 
    var local_invocation1 = getUniqueInvocations(invocation1);
    var local_invocation2 = getUniqueInvocations(invocation2);

    console.log("Invocation1 has " + local_invocation1.length + " unqiue entries");
    console.log("Invocation2 has " + local_invocation2.length + " unique entries");

    local_invocation1.forEach(function(entry1){
        local_invocation2.forEach(function(entry2){
            if (entry1 == entry2){
                functionNamesMatched++;
                // console.log(entry1 + " matched with " + entry2);
                return;
            }
        });
    });
    console.log("Functions that matched with the exact same name: "+ functionNamesMatched);

    var functionsMatched = []

    var outerCounter = 0;
     for (var entry1 in invocation1){
        outerCounter++
        var foundMatch = false
        for (var entry2 in invocation2){
            if (invocation1[entry1] != null && invocation2[entry2] != null) {
                // console.log("entry 1" + JSON.stringify(invocation1[entry1].globalDelta))
                // console.log("entry 2  " + JSON.stringify(invocation2[entry2].globalDelta));
                if (compareDictionaries(invocation1[entry1].globalDelta, invocation2[entry2].globalDelta) == true) { 
                    // console.log("Functions that matched " + invocation1[entry1] + " " + invocation2[entry2] )
                    functionsMatched.push(invocation1);
                    foundMatch = true
                    break;
                }
            }
        }
        if (!foundMatch)
            console.log("no match for :" + JSON.stringify(invocation1[entry1]) + " with id: " + outerCounter);
    };

    console.log("Functions matched:  " + functionsMatched.length);

    //compare the invocations to match any other invocation
    //Identical invocations imply a matching signature: nodeID, arguments, return value, globalDelta

}

function readInvocationArraysFromFile(){
    invocation1 = eval(fs.readFileSync(process.argv[2], "utf-8"));
    invocation2 = eval(fs.readFileSync(process.argv[3],"utf-8"));

}

function main(){

    // Read invocation arrays from files 
    readInvocationArraysFromFile();

    //compare the two invocation arrays using the definition of the signature priorly established
    compare();

}


main();