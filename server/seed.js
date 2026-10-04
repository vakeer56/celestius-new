import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Config from './models/Config.js';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/celestius';

async function seed() {
  console.log(' Connecting to MongoDB at:', MONGODB_URI.replace(/:([^:@]{3,})@/, ':****@'));
  try {
    await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 8000,
      bufferCommands: false,
    });
    console.log('✓ [DATABASE] Connected successfully.');

    const defaultDate = new Date('2026-10-15T23:59:59+05:30');
    const defaultClosedRoles = ['Backend Developer'];
    let existing = await Config.findOne({ key: 'recruitment_config' }).lean();

    if (!existing) {
      await Config.create({
        key: 'recruitment_config',
        recruitmentOpenStatus: true,
        registrationCloseDate: defaultDate,
        closedRoles: defaultClosedRoles,
      });
      console.log('✓ [SEED] Created fresh recruitment_config document in MongoDB.');
    } else {
      const updateFields = {};
      if (!existing.registrationCloseDate) {
        updateFields.registrationCloseDate = defaultDate;
      }
      if (!existing.closedRoles || !Array.isArray(existing.closedRoles)) {
        updateFields.closedRoles = defaultClosedRoles;
      }
      if (Object.keys(updateFields).length > 0) {
        await Config.updateOne(
          { key: 'recruitment_config' },
          { $set: updateFields }
        );
        console.log('✓ [SEED] Updated existing recruitment_config document with fields:', Object.keys(updateFields).join(', '));
      } else {
        console.log('✓ [SEED] recruitment_config already up to date in MongoDB.');
      }
    }

    const finalDoc = await Config.findOne({ key: 'recruitment_config' }).lean();

    console.log({
      key: finalDoc.key,
      recruitmentOpenStatus: finalDoc.recruitmentOpenStatus,
      closedRoles: finalDoc.closedRoles || [],
      registrationCloseDate: finalDoc.registrationCloseDate ? finalDoc.registrationCloseDate.toISOString() : null,
      formattedIST: finalDoc.registrationCloseDate
        ? new Date(finalDoc.registrationCloseDate).toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }) + ' IST'
        : 'N/A',
    });

    console.log('\n✓ Seeding completed successfully.');
  } catch (err) {
    console.error('✗ [SEED ERROR]:', err.message);
  } finally {
    await mongoose.disconnect();
    console.log(' Disconnected from MongoDB.');
    process.exit(0);
  }
}

seed();
