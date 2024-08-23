import {describe, it, expect} from '@jest/globals';

import { Fixture, FixtureList } from "../src/fixtures";

describe('Tickets Availability', () => {

    const index = new FixtureList();

    it('should successfully download the index from the Liverpool FC site', async () => {
        const result: boolean = await index.download();
        expect(result).toEqual(true);
    });

    it('should successfully download an individual fixture from the Liverpool FC site', async () => {
        index.find();
        const fixtures: Array<Fixture> = index.getFixtures();
        const result: boolean = await fixtures[0].download();
        expect(result).toEqual(true);
    });

});