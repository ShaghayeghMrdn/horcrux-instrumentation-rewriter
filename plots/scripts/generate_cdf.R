#!/usr/bin/env Rscript


# Create CDF charts 

# library(ggplot2)
# library(ggthemes)
# library(extrafont)
# library(plyr)
# library(scales)
# library(reshape2)

args = commandArgs(trailingOnly=TRUE)

d1 = read.csv(args[1], header=TRUE, sep=",")
d2 = read.csv(args[2], header=TRUE, sep=",")

d3 = read.csv("vroom_nexus6.csv")

d1$totalTime = rowSums(d1[,-1])
d2$totalTime = rowSums(d2[,-1])

pdf(args[3])
par(mar=c(5,3,3,3))
plot(ecdf(d1$totalTime), ylab="CDF across websites",
 main="Alexa Top 75 News&Sports websites",
 xlab="Total computation times(ms)",
 col="red")
# plot(ecdf(d2$totalTime), add=TRUE, col="blue")
lines(ecdf(d2$totalTime), col="blue")
lines(x=d3[,2],y=d3[,1], col="orange", type="p")
legend("right", legend=c("Pixel 2", "Mac", "Nexus 6 (Vroom)"),
       col=c("red", "blue", "orange"), lty=1:2, cex=0.8)
grid(nx = NULL, ny = NULL)


