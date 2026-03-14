import path from "path";
import process from "process";
import ts from "typescript";

const projectPath = path.resolve("src/main/ts/tsconfig.json");
const bridgeRoot = path.resolve("src/main/ts") + path.sep;

const configFile = ts.readConfigFile(projectPath, ts.sys.readFile);
if (configFile.error) {
    reportAndExit([configFile.error]);
}

const parsedConfig = ts.parseJsonConfigFileContent(
    configFile.config,
    ts.sys,
    path.dirname(projectPath),
    undefined,
    projectPath,
);

const program = ts.createProgram({
    rootNames: parsedConfig.fileNames,
    options: parsedConfig.options,
});

const allDiagnostics = ts.getPreEmitDiagnostics(program);
const localDiagnostics = allDiagnostics.filter((diagnostic) => {
    if (!diagnostic.file) {
        return true;
    }

    const diagnosticPath = path.resolve(diagnostic.file.fileName);
    return diagnosticPath.startsWith(bridgeRoot);
});

if (localDiagnostics.length > 0) {
    reportAndExit(localDiagnostics);
}

const ignoredCount = allDiagnostics.length - localDiagnostics.length;
if (ignoredCount > 0) {
    console.log(`JS bridge typecheck passed (${ignoredCount} external pokerogue diagnostics ignored).`);
} else {
    console.log("JS bridge typecheck passed.");
}

function reportAndExit(diagnostics) {
    const formatHost = {
        getCanonicalFileName: (fileName) => fileName,
        getCurrentDirectory: () => process.cwd(),
        getNewLine: () => ts.sys.newLine,
    };

    console.error(ts.formatDiagnosticsWithColorAndContext(diagnostics, formatHost));
    process.exit(1);
}
