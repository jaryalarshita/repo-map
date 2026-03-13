// =============================================================================
// parser/main.cpp — C++ Dependency Parser (Stub)
// =============================================================================
// Will be fully implemented in Prompt 5.
// Accepts a directory path as a command-line argument, walks all files,
// extracts import/require/#include dependencies, and outputs JSON to stdout.
// =============================================================================

#include <iostream>

int main(int argc, char* argv[]) {
    if (argc < 2) {
        std::cerr << "Usage: parser <directory>" << std::endl;
        return 1;
    }

    // Stub: print dummy JSON to stdout
    std::cout << R"({
  "nodes": [
    { "id": "stub.js", "label": "stub.js", "size": 10, "summary": null }
  ],
  "links": []
})" << std::endl;

    return 0;
}
