import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import * as Sentry from '@sentry/react';

export async function logError(type, message, context = {}) {
  // Always report to Sentry
  Sentry.captureException(new Error(`[${type}] ${message}`), {
    tags: { errorType: type },
    extra: context,
  });

  // Write to Firestore adminLogs for business-critical errors
  try {
    await addDoc(collection(db, 'adminLogs'), {
      type,
      message,
      userId: context.userId || null,
      context: JSON.stringify(context),
      timestamp: serverTimestamp(),
      userAgent: navigator.userAgent,
      route: context.route || window.location.hash || '/',
      resolved: false,
    });
  } catch (err) {
    console.error('Failed to write admin log:', err);
  }
}
