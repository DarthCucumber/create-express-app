#!/usr/bin/env node
const inquirer = require("inquirer");
const fs = require('fs-extra');
const path = require('path');
const ora = require('ora');
const chalk = require('chalk');
const { performChecks } = require('./helpers/checks');
const { getTemplateList, downloadTemplate } = require('./helpers/templates');
const { getRandomPhrase } = require('./helpers/misc');
const { createAppDataDir } = require('./helpers/filehandling');
const { setupProject } = require('./helpers/installs');
const Logto = require("./helpers/logger");
const Errfmt = require("errfmt");
const errfmt = new Errfmt({ colored: true });
let metadata = {
    logsdir: "",
    templatename: "",
    templatesdir: "",
    pkgmanager: "",
    projectname: "",
    debug: false
};

// TODO: improve logging
console.log(chalk.magentaBright.bold(`
 _  _  _
/_\/\/ //_| v0.1.0
_/
`));
// check for debug mode
const args = process.argv.slice(2);
if (args[0] === "-d" || args[0] === "--debug") {
    metadata.debug = true;
    console.log(chalk.yellow('> debug mode enabled'));
}

(async () => {
    // setup app data if doesn't exist
    const appdatadir = await createAppDataDir().catch(err => { errfmt.print(err) });
    Object.assign(metadata, appdatadir);
    // start logging
    let logger = new Logto(metadata.logsdir);
    logger.info(`platform: ${process.platform}`);

    let spinner = ora('Performing checks').start();
    let result = await performChecks().catch(err => {
        spinner.fail("checks failed");
        errfmt.include("message").print(err);
        logger.handleError(err);
    });
    metadata.pkgmanager = result;
    spinner.succeed("Checks complete");
    logger.info("Checks complete");
    // fetch template list
    spinner.text = "Fetching template"
    spinner.start();
    const templateList = await getTemplateList().catch(err => {
        spinner.fail("Failed to fetch template list");
        errfmt.include("code", "syscall", "message").print(err);
        logger.handleError(err);
    });
    spinner.succeed("Fetched templates\n");
    logger.info("Fetched templates");
    console.log('know more about each templates or create your own:');
    console.log(chalk.greenBright.underline(`https://github.com/DarthCucumber/get-node-app-templates`));
    let answers = await inquirer
        .prompt([
            {
                type: 'list',
                name: 'templatename',
                message: `Select Template:`,
                choices: templateList
            }
            , {
                type: 'input',
                name: 'projectname',
                message: `Enter Project Name:`,
                validate: function (project) {
                    if (project.length === 0) {
                        return "project name cannot be empty";
                    }
                    return true;
                },
            }]);
    Object.assign(metadata, answers);
    // Download template
    spinner.text = `Downloading templates`;
    spinner.start();
    await downloadTemplate(metadata.templatesdir, metadata.templatename).catch(err => {
        spinner.fail("Failed to download template");
        errfmt.include("exitCode", "message").print(err);
        logger.handleError(err);
    });
    spinner.succeed(`Template downloaded`);
    logger.info("Template downloaded");
    // create project directory
    await fs.ensureDir(metadata.projectname).then(() => {
        spinner.succeed(`project created: ${chalk.cyanBright(metadata.projectname)}`);
        logger.info(`Project Created: ${metadata.projectname}`);
    }).catch(err => {
        spinner.fail(`Failed to create project ${metadata.projectname}`);
        errfmt.include('code', 'message').print(err);
        logger.handleError(err);
    });
    // copy selected template from app data to project dir
    const templateContent = path.join(metadata.templatesdir, metadata.templatename);
    await fs.copy(templateContent, metadata.projectname).catch(err => {
        errfmt.include('code', 'message').print(err);
        logger.handleError(err);
    })
    logger.info(`copied file from ${templateContent} to ${metadata.templatename}`);
    // final setup
    spinner.text = "Setting up project";
    spinner.start();
    await setupProject(metadata.pkgmanager, metadata.projectname).catch(err => {
        spinner.fail("Failed to setup project");
        errfmt.include('exitCode', 'shortMessage').print(err);
        logger.handleError(err);
    });
    spinner.succeed(`Project setup complete\n`);
    logger.info(`Project setup complete`);
    console.log(`＼(＾O＾)／ All set\n`);
    /**
     * print random phrase
     * why? just for fun ;)
     */
    let rp = getRandomPhrase();
    console.log(chalk.magentaBright.bold(rp), "\n");
    logger.info(`random phrase generated`);
    // keep logfile in debug mode
    if (metadata.debug) {
        console.log(`log file can be found at ${chalk.cyan.underline(logger.logfile)}\n`);
        return;
    }
    await logger.deleteLog()
        .catch(err => {
            errfmt.print(err);
            logger.handleError(err);
        });
})();
