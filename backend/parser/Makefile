CXX = g++
CXXFLAGS = -std=c++17 -O3

all: parser

parser: main.cpp json.hpp
	$(CXX) $(CXXFLAGS) -o parser main.cpp

clean:
	rm -f parser

.PHONY: all clean
