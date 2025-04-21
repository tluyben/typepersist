/**
 * @fileoverview CardPairing storage types
 *
 * This file contains storage type definitions for the CardPairing table,
 * defining the data structures for persistent storage of card pairing information.
 */

import { Indexed, ManyToOne, PrimaryKey } from "../src/tstypes";

/**
 * CardPairing storage type
 *
 * Represents a card pairing process in the system with its status and details.
 */
export type CardPairing = {
  /**
   * Unique identifier for the card pairing
   */
  id: PrimaryKey<string>;

  /**
   * ID of the user who owns the card
   * Relationship: Many card pairings belong to one user
   */
  userId: ManyToOne<string, "User">;

  /**
   * ID of the card being paired
   * Relationship: Many card pairings belong to one card
   */
  cardId: ManyToOne<string, "Card">;

  /**
   * Status of the pairing process (e.g., 'pending', 'success', 'error')
   */
  status: Indexed<"pending" | "success" | "error">;

  /**
   * Error message if the pairing failed
   */
  errorMessage?: string;

  /**
   * PIN used for pairing (hashed)
   */
  pin?: string;

  /**
   * Timestamp when the pairing was created
   */
  createdAt: Indexed<Date>;

  /**
   * Timestamp when the pairing was last updated
   */
  updatedAt: Date;
};
