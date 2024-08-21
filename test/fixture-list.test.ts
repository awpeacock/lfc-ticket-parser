import {describe, beforeEach, it, expect, jest} from '@jest/globals';
import * as fs from 'fs';

import { FixtureList } from "../src/fixtures";

describe('Tickets Availability', () => {

    // Run this test separately outside the suite below - we only need to test the download functionality
    // once, and the other tests should not be impacted by the success or otherwise
    it('should successfully download from the Liverpool FC site', async () => {
        const index = new FixtureList();
        const result: boolean = await index.download();
        expect(result).toEqual(true);
    });

})

describe('Parsing fixtures', () => {

    // Share the index class with all methods.  To save on processing/performance, we only want to
    // retrieve this the once via beforeEach() and make it available to each test in the suite.
    const index = new FixtureList();
    const files: {[key: string]: string} = {
        index: fs.readFileSync('./test/mocks/availability-fixture-list.html', 'utf-8'),
        home: fs.readFileSync('./test/mocks/availability-home-active.html', 'utf-8'),
        inactive: fs.readFileSync('./test/mocks/availability-home-inactive.html', 'utf-8')
    };

    beforeEach(() => {
        global.fetch = jest.fn((input: RequestInfo | URL) => {
            const html = (input as URL).toString().endsWith('tickets-availability') ? files.index : files.home;
            return Promise.resolve({
                text: () => Promise.resolve(html)
            })
        }
        ) as jest.Mock<typeof fetch>;
        index.download();
    });

    it('should correctly read from the index page', () => {
        let size = 0;
        expect(() => { size = index.find() }).not.toThrow();
        expect(size).toEqual(10);
    });

    it('should throw errors if it cannot parse the index page', async () => {
        // Override the previous mock to force the download to fail, so we can
        // check find() handles this correctly (but also hide console error logs
        // so that they only show us useful stuff during testing)
        const fetch = jest.spyOn(global, 'fetch');
        fetch.mockImplementationOnce(() => Promise.reject('Failure retrieving HTML')); 
        const error = jest.spyOn(console, 'error')
        error.mockImplementation(() => null);

        const faulty = new FixtureList();
        await faulty.download();
        expect(() => faulty.find()).toThrow();

        error.mockRestore();
    });

});
