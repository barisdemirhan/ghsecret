import chalk from "chalk";

export function printHelp(version: string) {
  const b = chalk.bold;
  const d = chalk.dim;
  const c = chalk.cyan;

  console.log(`
${b("ghsecret")} v${version} - Push .env to GitHub Secrets & Variables

${b("USAGE")}
    ghsecret -s|-v [options]              Push as secret or variable
    ghsecret -i                           Interactive mode
    ghsecret push <key1> <key2> ... -s    Push specific keys

${b("MODES")}
    -s, --secret          Push as GitHub Secret(s)
    -v, --variable        Push as GitHub Variable(s)
    -i, --interactive     Interactive picker mode

${b("OPTIONS")}
    -f, --file <path>     Env file path (default: .env)
    -a, --all             Push all keys from the file
    -k, --keys <k1,k2>   Comma-separated keys to push
    --org <name>          Push to organization level
    --env <name>          Push to environment level
    --dry-run             Preview without pushing
    --force               Skip confirmation prompts
    --repo <o/r>          Target specific repository
    -h, --help            Show this help
    --version             Show version

${b("EXAMPLES")}
    ${d("# Push all .env vars as secrets")}
    ghsecret -s -a

    ${d("# Push specific keys as variables")}
    ghsecret -v -k APP_NAME,APP_URL

    ${d("# Interactive mode - pick & choose")}
    ghsecret -i

    ${d("# From custom file, dry run")}
    ghsecret -s -a -f .env.production --dry-run

    ${d("# Push to specific environment")}
    ghsecret -s -a --env staging

    ${d("# Push to organization")}
    ghsecret -s -k DB_PASSWORD --org my-org

    ${d("# Push to a specific repo")}
    ghsecret -s -a --repo my-org/my-repo
`);
}
