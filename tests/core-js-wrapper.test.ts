import { Wrapper, Cmp } from '../src/core-js-wrapper';

describe('CoreJS Wrapper', () => {
  let db: Wrapper;

  beforeAll(async () => {
    db = new Wrapper(':memory:');
  });

  afterAll(async () => {
    await db.close();
  });

  it('should create a table with schema builder', async () => {
    const schema = db.schema('users')
      .field('name').type('Text').required().done()
      .field('age').type('Integer').done()
      .field('email').type('Text').index('Unique').done();

    await db.createTable(schema);

    // Insert test data
    const id = await db.insert('users', {
      name: 'John Doe',
      age: 30,
      email: 'john@example.com'
    });

    // Query the data
    const results = await db.query('users')
      .where('age', Cmp.Gte, 25)
      .and('name', Cmp.Like, 'John')
      .execute();

    expect(results).toHaveLength(1);
    expect(results[0].name).toBe('John Doe');
    expect(results[0].age).toBe(30);
  });

  it('should support table joins', async () => {
    // Create posts table with foreign key
    const postsSchema = db.schema('posts')
      .field('title').type('Text').required().done()
      .field('usersId').type('ReferenceManyToOne').reference('users').done();

    await db.createTable(postsSchema);

    // Insert test post
    const postId = await db.insert('posts', {
      title: 'Test Post',
      usersId: 1 // References John Doe from previous test
    });

    // Query with join
    const results = await db.query('users')
      .join('posts')
      .where('name', Cmp.Eq, 'John Doe')
      .execute();

    expect(results).toHaveLength(1);
    expect(results[0].posts).toHaveLength(1);
    expect(results[0].posts[0].title).toBe('Test Post');
  });

  it('should support complex queries', async () => {
    // Insert more test data
    await db.insert('users', {
      name: 'Jane Smith',
      age: 25,
      email: 'jane@example.com'
    });

    const results = await db.query('users')
      .where('age', Cmp.Gte, 25)
      .and('age', Cmp.Lte, 35)
      .or('name', Cmp.Like, 'Smith')
      .orderBy('age', 'desc')
      .limit(10)
      .execute();

    expect(results.length).toBeGreaterThan(0);
    expect(results[0].age).toBeGreaterThanOrEqual(25);
    expect(results[0].age).toBeLessThanOrEqual(35);
  });
});
