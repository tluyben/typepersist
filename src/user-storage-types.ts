/**
 * @fileoverview User storage types
 *
 * This file contains storage type definitions for the User table,
 * defining the data structures for persistent storage of user information.
 */

import { PrimaryKey, Unique, Indexed } from './tstypes';

/**
 * User storage type
 *
 * Represents a user in the system with their personal and authentication information.
 */
export type User = {
  /**
   * Unique identifier for the user
   */
  id: PrimaryKey<string>;

  /**
   * User's email address
   */
  email: Unique<string>;

  /**
   * User's mobile phone number
   */
  mobileNumber: Unique<string>;

  /**
   * Country code for the mobile number
   */
  countryCode: string;

  /**
   * User's first name
   */
  firstName: Indexed<string>;

  /**
   * User's last name
   */
  lastName: Indexed<string>;

  /**
   * User's residential address
   */
  residentialAddress: string;

  /**
   * User's suburb
   */
  suburb: Indexed<string>;

  /**
   * User's city
   */
  city: Indexed<string>;

  /**
   * User's state
   */
  state: Indexed<string>;

  /**
   * User's postcode
   */
  postcode: Indexed<string>;

  /**
   * User's country
   */
  country: Indexed<string>;

  /**
   * User's passcode (hashed)
   */
  passcode: string;

  /**
   * Whether Face ID is enabled for the user
   */
  isFaceIdEnabled: boolean;

  /**
   * Whether PIN is enabled for the user
   */
  isPinEnabled: boolean;

  /**
   * User's PIN (hashed)
   */
  pin: string;

  /**
   * Timestamp when the user was created
   */
  createdAt: Indexed<Date>;

  /**
   * Timestamp when the user was last updated
   */
  updatedAt: Date;
}; 