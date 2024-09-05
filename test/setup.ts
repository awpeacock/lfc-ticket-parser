import {jest} from '@jest/globals';
import * as fs from 'fs';

export default function() {

    const files: {[key: string]: string} = {
        index: fs.readFileSync('./test/mocks/availability-fixture-list.html', 'utf-8'),
        home: fs.readFileSync('./test/mocks/availability-home-active.html', 'utf-8'),
        away: fs.readFileSync('./test/mocks/availability-away-active.html', 'utf-8'),
        multiple: fs.readFileSync('./test/mocks/availability-home-multiple.html', 'utf-8'),
        bulk1: fs.readFileSync('./test/mocks/availability-home-bulk-1.html', 'utf-8'),
        bulk2: fs.readFileSync('./test/mocks/availability-home-bulk-2.html', 'utf-8'),
        subject: fs.readFileSync('./test/mocks/availability-away-subject.html', 'utf-8'),
        euro: fs.readFileSync('./test/mocks/availability-away-euro.html', 'utf-8'),
        inactive: fs.readFileSync('./test/mocks/availability-home-inactive.html', 'utf-8'),
        sold: fs.readFileSync('./test/mocks/availability-away-inactive.html', 'utf-8')
    };
    global.fetch = jest.fn((input: RequestInfo | URL) => {
        const url: string = (input as URL).toString();
        let html: string = '';
        if ( url.endsWith('tickets-availability') ) {
            html = files.index;
        } else if ( url.includes('brentford') ) {
            html = files.home;
        } else if ( url.includes('chelsea') ) {
            html = files.multiple;
        } else if ( url.includes('brighton') ) {
            html = files.bulk1;
        } else if ( url.includes('aston-villa') ) {
            html = files.bulk2;
        } else if ( url.includes('wolverhampton-wanderers') ) {
            html = files.away;
        } else if ( url.includes('manchester-utd') ) {
            html = files.subject;
        } else if ( url.includes('ac-milan') ) {
            html = files.euro;
        } else if ( url.includes('nottingham-forest') ) {
            html = files.inactive;
        } else if ( url.includes('manchester-united') ) {
            html = files.sold;
        }
        return Promise.resolve({
            text: () => Promise.resolve(html)
        })
    }) as jest.Mock<typeof fetch>;

    const error = jest.spyOn(console, 'error');
    error.mockImplementation(() => null);

}