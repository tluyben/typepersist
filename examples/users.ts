import { DB, DBUnique, DBRequired } from '../src/types';
import { CoreDB } from '../src/core-db';

// Initialize database
const db = new CoreDB(':memory:');

// Just define the tables with their types - the transformer handles everything else
const users: DB<{
    email: DBUnique<string>;
    name: string;
    age: number;
    isActive: boolean;
}> = null!; // The transformer will replace this

const orders: DB<{
    orderId: DBUnique<string>;
    userId: DBRequired<number>;
    productId: DBRequired<number>;
    quantity: number;
    orderDate: Date;
    status: 'pending' | 'shipped' | 'delivered';
}> = null!; // The transformer will replace this

// The transformer will automatically:
// 1. Create the tables with proper schemas
// 2. Set up Zod validation
// 3. Create type-safe query builders
// 4. Handle all CRUD operations with runtime checks

async function example() {
    // Everything is type-safe and validated at runtime
    const userId = await users.insert({
        email: 'test@example.com',  // Type constraints are handled by the transformer
        name: 'Test User',
        age: 25,
        isActive: true
    });

    const orderId = await orders.insert({
        orderId: 'ORD-001',  // Type constraints are handled by the transformer
        userId,              // Type constraints are handled by the transformer
        productId: 1,        // Type constraints are handled by the transformer
        quantity: 2,
        orderDate: new Date(),
        status: 'pending'
    });

    // Type-safe queries with runtime validation
    const userOrders = await orders.query()
        .where('userId', 'eq', userId)
        .orderBy('orderDate', 'desc')
        .get();
}
