import * as fs from 'fs';
import * as cp from 'child_process';
import archiver from 'archiver';

import { Narrator } from '@redpenguinstudio/herbert';

class Builder {

    path = 'lfct-aws-js';

    copyFolder() {
        Narrator.heading('Copying "dist" folder');
        try {
            fs.cpSync('./dist', '../' + this.path, {recursive: true});
            return true;
        } catch (e) {
            Narrator.error('Unable to copy folder', e);
            return false;
        }
    }

    async installDependency(module) {
        try {
            const result = await new Promise((resolve, reject) => {
                cp.exec('npm install ' + module, {cwd: '../' + this.path}, (error, stdout, stderr) => {
                    if ( error ) {
                        reject(error);
                    } else {
                        resolve('"' + module + '" Successfully installed');
                    }
                });
            });
            Narrator.info(result);
            return true;
        } catch (e) {
            Narrator.error('"' + module + '" install failed', e);
            return false;
        }
    }

    async createZip() {
        Narrator.heading('Zipping up folder');
        try {
            const target = 'outputs';
            if ( !fs.existsSync(target) ){
                fs.mkdirSync(target);
            }
            const output = fs.createWriteStream('./' + target + '/' + this.path + '.zip');
            output.on('error', function(e){
                return Narrator.error('Creating the zip file failed', e);
            });
            const zip = archiver('zip');
            zip.on('error', function(e){
                return Narrator.error('Building the zip file failed', e);
            });
            zip.pipe(output);
            zip.directory('../' + this.path, false);
            await zip.finalize();
        } catch (e) {
            Narrator.error('Zipping the folder failed');
        }
    }

    teardown() {
        Narrator.log('Tidying up');
        try {
            fs.rmSync('../lfct-aws-js', {recursive: true, force: true});
        } catch (e) {
            Narrator.error('Unable to remove folder', e);
        }
    }

}

const builder = new Builder();
Narrator.title('Building AWS deployment');
if ( builder.copyFolder() ) {
    Narrator.heading('Installing node module dependencies');
    if ( await builder.installDependency('dotenv') && await builder.installDependency('ics') && await builder.installDependency('nodemailer') && await builder.installDependency('@redpenguinstudio/herbert') ) {
        await builder.createZip();
    }
    builder.teardown();
}
Narrator.success('Build and bundle of AWS Lambda zip complete');
