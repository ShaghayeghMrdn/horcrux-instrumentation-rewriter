
# This is a small module just to inspect
# the contents of the protobuf files
# to debug content

import brotli
import http_record_pb2
import argparse
import zlib
import os
import re
import subprocess
import sys
from copy import deepcopy
from Naked.toolshed.shell import execute_js
import json
import unicodedata


def matchRtiWithMahimahi(rtiUrls, mahimahiUrls):
    unmatched = []
    for rtiUrl in rtiUrls:
        # print rtiUrl, len(rtiUrls[rtiUrl])
        foundMatch = False
        for mahimahiUrl in mahimahiUrls:
            if rtiUrl.endswith(mahimahiUrl):
                foundMatch = True
        if not foundMatch:
            unmatched.append(rtiUrl)
    if len(rtiUrls) != 0:
        sys.stdout.write(str(len(unmatched)*100.0/len(rtiUrls)) + " ")
        sys.stdout.flush()

def unchunk(body):
    new_body = ""
    # iterate through chunks until we hit the last chunk
    crlf_loc = body.find('\r\n')
    chunk_size = int( body[:crlf_loc], 16 )
    body = body[crlf_loc+2:]
    while( chunk_size != 0 ):
        # add chunk content to new body and remove from old body
        new_body += body[0:chunk_size]
        body = body[chunk_size:]

        # remove CRLF trailing chunk
        body = body[2:]

        # get chunk size
        crlf_loc = body.find('\r\n')
        chunk_size = int( body[:crlf_loc], 16 )
        body = body[crlf_loc+2:]

    # on the last chunk
    body = body[crlf_loc+2:]

    return new_body

def main(args):

    mahimahiUrls = []
    rtiUrls = {}
    # extract js Urls
    http_response = http_record_pb2.RequestResponse()

    for root, folder, files in os.walk(args.mahimahi):
        scriptsToInstrument = [];
        url = root.split('/')[-2]
        urls = []
        for file in files:
                isJs = False
                f = open(os.path.join(root,file), "rb")
                # print file
                http_response.ParseFromString(f.read())
                f.close()

                for header in http_response.response.header:
                    if header.key.lower() == "content-type":
                        if "json" in header.value.lower():
                            print http_response.response.body
                            # print http_response.request.first_line.split()[1], header.value.lower(), file
                #             isJs = True


                # if file == "save.1rKexX":
                #     print http_response.response.header
                #     open("tmp","w").write(unchunk(http_response.response.body))
                #     # print http_response.response.body
                # # if i dsJs:
                # for header in http_response.response.header:
                #     # print header.key
                #     if header.key.lower() == "content-security-policy":
                #         print  header.value.lower()
                url = http_response.request.first_line.split()[1]
                # print url == "/"
                urls.append(url)
                # if url == "/":
                # print http_response.request.first_line
           
                # print http_response.response.header
                if "batch" in url:
                    print url
                # for header in http_response.response.header:
                #     if "set-cookie" in header.key.lower():
                #         print  url, header.value
                if "mnet_session_depth" in http_response.response.body:
                    print file, http_response.response.body.index("mnet")
                # if url not in mahimahiUrls:
                #     mahimahiUrls.append(http_response.request.first_line.split()[1])

    # extract rti Urls
    # jsProfile = json.loads(open(args.jsProfile, 'r').readline())
    # for rtiNode in jsProfile:
    #     if rtiNode['url'] not in rtiUrls:
    #         rtiUrls[rtiNode['url']] = []
    #     rtiUrls[rtiNode['url']].append(rtiNode)

    # matchRtiWithMahimahi(rtiUrls, mahimahiUrls)
    sys.stdout.write(str(len(urls)))
    sys.stdout.flush()



if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument('mahimahi', help='path to input directory')
    parser.add_argument('jsProfile',help='path to processed jsProfile')
    args = parser.parse_args()
    main(args)