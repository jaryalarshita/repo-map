// =============================================================================
// main.cpp — High-Performance Dependency Parser
// =============================================================================
// ARCHITECTURE:
//   1. Accepts a directory path as a command-line argument
//   2. Walks the directory recursively using C++17 std::filesystem
//   3. For each code file (.js, .jsx, .ts, .tsx, .cpp, .cc, .h, .hpp, .py):
//      a. Reads the file into memory
//      b. Creates a "node" (file entry for the 3D graph)
//      c. Scans for dependency patterns using std::string::find
//         (10-100x faster than std::regex for simple substring matching)
//   4. Outputs a single JSON object to stdout:
//      { "nodes": [...], "links": [...] }
//   5. Node.js parserService.js captures this stdout via child_process.spawn
//
// WHY std::string::find instead of std::regex?
//   std::regex compiles a regex state machine per call — surprisingly slow
//   on large files. string::find is a raw memory scan. For our simple
//   patterns (import, require, #include), it's all we need.
//
// COMPILATION:
//   g++ -std=c++17 -O3 -o parser main.cpp
// =============================================================================

#include <iostream>
#include <fstream>
#include <sstream>
#include <string>
#include <vector>
#include <set>
#include <filesystem>
#include "json.hpp"

namespace fs = std::filesystem;
using json = nlohmann::json;

// ---------------------------------------------------------------------------
// Utility: Check if a file extension should be parsed
// ---------------------------------------------------------------------------
bool isSupportedExtension(const std::string& ext) {
    static const std::set<std::string> supported = {
        ".js", ".jsx", ".ts", ".tsx",   // JavaScript / TypeScript
        ".cpp", ".cc", ".h", ".hpp",    // C / C++
        ".py"                            // Python
    };
    return supported.count(ext) > 0;
}

// ---------------------------------------------------------------------------
// Utility: Read an entire file into a string
// ---------------------------------------------------------------------------
std::string readFile(const fs::path& filePath) {
    std::ifstream file(filePath, std::ios::binary);
    if (!file.is_open()) return "";

    std::ostringstream ss;
    ss << file.rdbuf();
    return ss.str();
}

// ---------------------------------------------------------------------------
// Utility: Extract text between quotes (single or double) after a position
// ---------------------------------------------------------------------------
std::string extractBetweenQuotes(const std::string& line, size_t startPos) {
    // Find the first quote character after startPos
    size_t q1 = std::string::npos;
    char quoteChar = '"';

    size_t dq = line.find('"', startPos);
    size_t sq = line.find('\'', startPos);

    if (dq != std::string::npos && (sq == std::string::npos || dq < sq)) {
        q1 = dq;
        quoteChar = '"';
    } else if (sq != std::string::npos) {
        q1 = sq;
        quoteChar = '\'';
    }

    if (q1 == std::string::npos) return "";

    size_t q2 = line.find(quoteChar, q1 + 1);
    if (q2 == std::string::npos) return "";

    return line.substr(q1 + 1, q2 - q1 - 1);
}

// ---------------------------------------------------------------------------
// Core: Parse JS/TS dependencies from file content
// ---------------------------------------------------------------------------
std::vector<std::string> parseJSDeps(const std::string& content) {
    std::vector<std::string> deps;
    std::istringstream stream(content);
    std::string line;

    while (std::getline(stream, line)) {
        // -----------------------------------------------------------------
        // Pattern 1: import ... from '...' or import ... from "..."
        // Example:   import App from './App';
        //            import { useState } from 'react';
        // -----------------------------------------------------------------
        size_t importPos = line.find("import");
        if (importPos != std::string::npos) {
            size_t fromPos = line.find("from", importPos);
            if (fromPos != std::string::npos) {
                std::string dep = extractBetweenQuotes(line, fromPos);
                if (!dep.empty()) {
                    deps.push_back(dep);
                    continue;
                }
            }
        }

        // -----------------------------------------------------------------
        // Pattern 2: require('...') or require("...")
        // Example:   const express = require('express');
        // -----------------------------------------------------------------
        size_t reqPos = line.find("require(");
        if (reqPos != std::string::npos) {
            std::string dep = extractBetweenQuotes(line, reqPos);
            if (!dep.empty()) {
                deps.push_back(dep);
                continue;
            }
        }
    }

    return deps;
}

// ---------------------------------------------------------------------------
// Core: Parse C/C++ dependencies from file content
// ---------------------------------------------------------------------------
std::vector<std::string> parseCppDeps(const std::string& content) {
    std::vector<std::string> deps;
    std::istringstream stream(content);
    std::string line;

    while (std::getline(stream, line)) {
        // -----------------------------------------------------------------
        // Pattern: #include "header.h" (local includes only, not <system>)
        // Example:  #include "utils.h"
        // -----------------------------------------------------------------
        size_t incPos = line.find("#include");
        if (incPos != std::string::npos) {
            // Only parse quoted includes (local), not angle-bracket (system)
            size_t q1 = line.find('"', incPos);
            if (q1 != std::string::npos) {
                size_t q2 = line.find('"', q1 + 1);
                if (q2 != std::string::npos) {
                    deps.push_back(line.substr(q1 + 1, q2 - q1 - 1));
                }
            }
        }
    }

    return deps;
}

// ---------------------------------------------------------------------------
// Core: Parse Python dependencies from file content
// ---------------------------------------------------------------------------
std::vector<std::string> parsePythonDeps(const std::string& content) {
    std::vector<std::string> deps;
    std::istringstream stream(content);
    std::string line;

    while (std::getline(stream, line)) {
        // Pattern: import module  OR  from module import ...
        size_t fromPos = line.find("from ");
        if (fromPos != std::string::npos && fromPos < 5) {
            size_t importPos = line.find(" import", fromPos);
            if (importPos != std::string::npos) {
                std::string module = line.substr(fromPos + 5, importPos - fromPos - 5);
                // Trim whitespace
                size_t start = module.find_first_not_of(" \t");
                if (start != std::string::npos) {
                    module = module.substr(start);
                    size_t end = module.find_first_of(" \t");
                    if (end != std::string::npos) module = module.substr(0, end);
                    if (!module.empty()) deps.push_back(module);
                }
                continue;
            }
        }

        // Simple: import module
        size_t impPos = line.find("import ");
        if (impPos != std::string::npos && impPos < 5) {
            std::string module = line.substr(impPos + 7);
            size_t start = module.find_first_not_of(" \t");
            if (start != std::string::npos) {
                module = module.substr(start);
                size_t end = module.find_first_of(" \t,");
                if (end != std::string::npos) module = module.substr(0, end);
                if (!module.empty()) deps.push_back(module);
            }
        }
    }

    return deps;
}

// ---------------------------------------------------------------------------
// Utility: Check if a dependency should be skipped
// ---------------------------------------------------------------------------
bool shouldSkipDep(const std::string& dep) {
    // Skip node_modules imports (external packages like 'react', 'express')
    if (dep.find("node_modules") != std::string::npos) return true;
    // Skip scoped packages like @babel/core, @types/node
    if (!dep.empty() && dep[0] == '@') return true;
    // Skip absolute module names (no ./ or ../ prefix) — these are npm packages
    // We only want local file imports for the dependency graph
    if (!dep.empty() && dep[0] != '.' && dep.find('/') == std::string::npos) return true;
    return false;
}

// =============================================================================
// MAIN
// =============================================================================
int main(int argc, char* argv[]) {
    // -------------------------------------------------------------------------
    // Step 1: Validate command-line argument
    // -------------------------------------------------------------------------
    if (argc < 2) {
        std::cerr << "Usage: parser <directory>" << std::endl;
        return 1;
    }

    fs::path baseDir(argv[1]);

    if (!fs::exists(baseDir) || !fs::is_directory(baseDir)) {
        std::cerr << "Error: '" << argv[1] << "' is not a valid directory" << std::endl;
        return 1;
    }

    // -------------------------------------------------------------------------
    // Step 2: Walk directory and build nodes + links
    // -------------------------------------------------------------------------
    json nodes = json::array();
    json links = json::array();

    // Track which file IDs exist so we only create links to real files
    std::set<std::string> nodeIds;

    // First pass: collect all file nodes
    for (const auto& entry : fs::recursive_directory_iterator(baseDir,
            fs::directory_options::skip_permission_denied)) {

        if (!entry.is_regular_file()) continue;

        std::string ext = entry.path().extension().string();
        if (!isSupportedExtension(ext)) continue;

        // Skip node_modules and hidden directories
        std::string fullPath = entry.path().string();
        if (fullPath.find("node_modules") != std::string::npos) continue;
        if (fullPath.find("/.") != std::string::npos) continue;

        // Compute relative path from the base directory
        std::string relPath = fs::relative(entry.path(), baseDir).string();
        std::string filename = entry.path().filename().string();

        // Determine node size based on file size (bigger file = bigger node)
        auto fileSize = fs::file_size(entry.path());
        int nodeSize = 8 + static_cast<int>(fileSize / 500); // scale factor
        if (nodeSize > 30) nodeSize = 30; // cap maximum size

        nodes.push_back({
            {"id", relPath},
            {"label", filename},
            {"size", nodeSize},
            {"summary", nullptr}
        });

        nodeIds.insert(relPath);
    }

    // Second pass: parse dependencies and create links
    for (const auto& entry : fs::recursive_directory_iterator(baseDir,
            fs::directory_options::skip_permission_denied)) {

        if (!entry.is_regular_file()) continue;

        std::string ext = entry.path().extension().string();
        if (!isSupportedExtension(ext)) continue;

        std::string fullPath = entry.path().string();
        if (fullPath.find("node_modules") != std::string::npos) continue;
        if (fullPath.find("/.") != std::string::npos) continue;

        std::string relPath = fs::relative(entry.path(), baseDir).string();
        std::string content = readFile(entry.path());

        if (content.empty()) continue;

        // Choose parser based on file extension
        std::vector<std::string> deps;
        if (ext == ".js" || ext == ".jsx" || ext == ".ts" || ext == ".tsx") {
            deps = parseJSDeps(content);
        } else if (ext == ".cpp" || ext == ".cc" || ext == ".h" || ext == ".hpp") {
            deps = parseCppDeps(content);
        } else if (ext == ".py") {
            deps = parsePythonDeps(content);
        }

        // Create links for each dependency
        for (const auto& dep : deps) {
            if (shouldSkipDep(dep)) continue;

            // Resolve the relative import path against the current file's directory
            fs::path currentDir = fs::path(relPath).parent_path();
            fs::path resolved = (currentDir / dep).lexically_normal();
            std::string target = resolved.string();

            // Try adding common extensions if the target doesn't exist as-is
            std::vector<std::string> candidates = {
                target,
                target + ".js",
                target + ".jsx",
                target + ".ts",
                target + ".tsx",
                target + "/index.js",
                target + "/index.tsx"
            };

            for (const auto& candidate : candidates) {
                if (nodeIds.count(candidate)) {
                    links.push_back({
                        {"source", relPath},
                        {"target", candidate}
                    });
                    break; // Take the first match
                }
            }
        }
    }

    // -------------------------------------------------------------------------
    // Step 3: Output the final JSON to stdout
    // -------------------------------------------------------------------------
    json output;
    output["nodes"] = nodes;
    output["links"] = links;

    // Pretty print with 2-space indent
    std::cout << output.dump(2) << std::endl;

    return 0;
}
