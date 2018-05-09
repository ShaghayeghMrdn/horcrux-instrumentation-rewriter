
import argparse
import json
import os
import operator


def computeOccurances(obj):
    functionToInvocation = {}
    length = len(obj["nodes"])
    for i in range(1,length+1):
        functionToInvocation[i] = [j for j,x in enumerate(obj["samples"]) if x == i]
    return functionToInvocation

def computeTTime(obj, functionToInvocation):
    functionToTTime = {}
    length = len(obj["nodes"])
    for i in range(length):
        ttime = 0
        for ind in functionToInvocation[i+1]:
            ttime = ttime + obj["timeDeltas"][ind]
        functionToTTime[obj["nodes"][i]["callFrame"]["functionName"]] = [ttime, obj["nodes"][i]["callFrame"]["url"]]
    return functionToTTime

def maxScriptPerUrl(obj):
    urlToTime = {}
    for fn in obj:
        if obj[fn][1] not in urlToTime:
            urlToTime[obj[fn][1]] = 0
        urlToTime[obj[fn][1]] = urlToTime[obj[fn][1]] + int(obj[fn][0])
    sortedUrlToTime = sorted(urlToTime.items(), key=operator.itemgetter(1), reverse = True)
    return sortedUrlToTime


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('trace', help="path to the list of traces")
    parser.add_argument('output', help="path to the output directory")
    parser.add_argument('parse',help='true for parsing, false for analyzing')
    args = parser.parse_args()

    if (int(args.parse)):
        stats = {}
        for root, folder, files in os.walk(args.trace):
            for file in files:
                print "handling {}".format(os.path.join(root,file))
                profile = os.path.join(root , file)
                with open(profile, 'r') as f:
                    jsprofile = json.loads(f.read())
                    functionToInvocation = computeOccurances(jsprofile)
                    functionToTTime = computeTTime(jsprofile, functionToInvocation)

                    stats[root] = functionToTTime


        with open(args.output,'w') as f:
            f.write(json.dumps(stats))
    else:
        data = json.loads(open(args.trace,'r').read())
        stats = {}
        for site in data: 
            urlToTime = maxScriptPerUrl(data[site])
            stats[site] = urlToTime
        # print stats
        with open(args.output,'w') as f:
            f.write(json.dumps(stats))