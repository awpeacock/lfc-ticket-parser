import {describe, it, expect, jest} from '@jest/globals';
import dotenv, { DotenvConfigOutput } from 'dotenv';

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

    it('should return false if an attempt is made to download the index or a fixture without the requisite environment variable', async() => {

        const config = jest.spyOn(dotenv, 'config');
        const output: DotenvConfigOutput = {};
        config.mockImplementation(() => { return output; });
        delete process.env.DOMAIN;

        const fixtures: Array<Fixture> = index.getFixtures();
        await expect(fixtures[0].download()).resolves.toBe(false);
        await expect(index.download()).resolves.toBe(false);

    });

});