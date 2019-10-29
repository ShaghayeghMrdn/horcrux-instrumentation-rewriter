import http_record_pb2
import sys
import subprocess
import os

srcDstPath = "../tests/hostSrc/"
originalSrcPath = "../JSAnalyzer/"
cwd = os.getcwd()
if "BACKUP" in cwd:
    srcProto = "../traces/mobile/alexa_1000/www.ign.com/save.15PLMI"
else: srcProto = "../traces/mobile/alexa_1000/www.ign.com/save.15PLMI"



def createFillerObject():
    filler_request = http_record_pb2.RequestResponse()
    filler_proto = open(srcProto,"r").read()
    filler_request.ParseFromString(filler_proto)

    return filler_request

def zipBody(content):
    inputFile = str(os.getpid())
    outputFile = str(os.getpid()) + ".gz"
    with open(inputFile ,'w') as i:
        i.write(content)

    zipCommand = "{} -c {} > {}".format("gzip", inputFile, outputFile)
    cmd = subprocess.call(zipCommand, shell=True)
    # while cmd.poll() is None:
    #     continue

    o = open(outputFile,'r').read()

    subprocess.call("rm {} {}".format(inputFile, outputFile +".info"),stderr=open("/dev/null","r"), shell=True)
    return o



def createProtoFile(src):
    
    input = open(srcDstPath+src).read()
    http_request = createFillerObject()

    http_request.response.body = zipBody(input)

    #modify the host
    http_request.request.header[0].value = "goelayu4929.eecs.umich.edu"
    #modify content-length
    http_request.response.header[3].value = str(len(http_request.response.body))
    #modify content-type
    http_request.response.header[2].value = "text/javascript"
    #modify first line
    http_request.request.first_line = 'GET /hostSrc/' + src + ' HTTP/1.1'

    #make cache expire age infinite
    http_request.response.header[5].value = "public, max-age=1000000, s-maxage=1000000"

    #delete the pragma response header
    del http_request.response.header[6]

    #delete the expires header
    del http_request.response.header[6]
    ce = http_request.response.header.add()
    ce.key = "Content-Encoding"
    ce.value = "gzip"

    # et = http_request.response.header.add()
    # et.key = "ETag"
    # et.value = "5cfafb0d-a4fb"

    #modify the ip port and scheme
    http_request.ip = u"141.212.110.88"
    http_request.port = 99
    http_request.scheme = 1


    output = open(srcDstPath + "save_" + src ,'w')
    output.write(http_request.SerializeToString())
    output.close()

def updateSource(src):
    subprocess.Popen("cp {} {}".format(originalSrcPath+src, srcDstPath+src),shell=True)


if __name__ == '__main__':
    # if (sys.argv[1] != "tracer.js"):
        # updateSource(sys.argv[1])
    for i in range(1,len(sys.argv)):
        createProtoFile(sys.argv[i])




#################################
 # Filler object header structure for reference

 # header {
 #   key: "Server"
 #   value: "Server"
 # }
 # header {
 #   key: "Date"
 #   value: "Tue, 07 May 2019 17:07:11 GMT"
 # }
 # header {
 #   key: "Content-Type"
 #   value: "text/javascript"
 # }
 # header {
 #   key: "Content-Length"
 #   value: "1772"
 # }
 # header {
 #   key: "Connection"
 #   value: "keep-alive"
 # }
 # header {
 #   key: "Cache-Control"
 #   value: "max-age=0, no-cache, no-store, private, must-revalidate, s-maxage=0"
 # }
 # header {
 #   key: "Pragma"
 #   value: "no-cache"
 # }
 # header {
 #   key: "Expires"
 #   value: "Thu, 01 Jan 1970 00:00:00 GMT"
 # }
 # header {
 #   key: "Vary"
 #   value: "User-Agent"
 # }
 #####################################