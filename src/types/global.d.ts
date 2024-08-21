/** 
 * A type alias used to represent all variables that could be "null".
 * @typeParam T - the type of the object that could be null.
 */
declare type Nullable<T> = T | null;

/** 
 * A type alias used to represent all variables that could be "undefined".
 * @typeParam T - the type of the object that could be undefined.
 */
declare type Undefinable<T> = T | undefined;

/** A type alias used to represent all variations for a fixture's venue - H (Home), A (Away), N (Neutral) or U (Unknown). */
declare type Venue = 'H' | 'A' | 'N' | 'U';