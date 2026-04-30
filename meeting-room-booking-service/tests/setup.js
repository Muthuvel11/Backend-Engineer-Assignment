// tests/setup.js — Shared Supabase mock utilities

/**
 * Creates a chainable mock that mimics the Supabase query builder.
 * Each method returns `this` so calls can be chained, and the final
 * call resolves to whatever `_result` is set to.
 */
export function createMockQueryBuilder(result = { data: null, error: null, count: null }) {
    const builder = {
        _result: result,

        select(columns, opts) { return this; },
        insert(rows) { return this; },
        update(values) { return this; },
        delete() { return this; },
        eq(col, val) { return this; },
        neq(col, val) { return this; },
        gt(col, val) { return this; },
        gte(col, val) { return this; },
        lt(col, val) { return this; },
        lte(col, val) { return this; },
        contains(col, val) { return this; },
        order(col, opts) { return this; },
        range(from, to) { return this; },
        single() { return Promise.resolve(this._result); },
        maybeSingle() { return Promise.resolve(this._result); },

        // Default "then" — resolves to _result when awaited directly
        then(resolve, reject) {
            return Promise.resolve(this._result).then(resolve, reject);
        }
    };
    return builder;
}

/**
 * Creates a mock supabase client with `.from()` returning the provided
 * query builder (or a default one).
 */
export function createMockSupabase(queryBuilder) {
    return {
        from(table) {
            return queryBuilder || createMockQueryBuilder();
        }
    };
}
