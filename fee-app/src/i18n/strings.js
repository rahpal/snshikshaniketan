/**
 * Interface strings, English and Hindi.
 *
 * Only the Phase 1 surface is covered so far; later phases add their own keys
 * here. A missing Hindi key falls back to English rather than showing a blank.
 */
export const strings = {
  en: {
    'app.name': 'Fee Register',
    'app.school': 'S.N.S. Shiksha Niketan',
    'app.tagline': 'Tuition fee records',

    'login.heading': 'Sign in',
    'login.subheading': 'Use the username and password given to you by the administrator.',
    'login.username': 'Username',
    'login.password': 'Password',
    'login.submit': 'Sign in',
    'login.submitting': 'Signing in...',
    'login.noAccount': 'Accounts are created by the administrator. There is no self sign-up.',
    'login.showPassword': 'Show password',
    'login.hidePassword': 'Hide password',

    'password.heading': 'Set a new password',
    'password.firstTime': 'This is your first sign-in, so you need to choose your own password before continuing.',
    'password.routine': 'Choose a new password for your account.',
    'password.current': 'Current password',
    'password.new': 'New password',
    'password.confirm': 'Confirm new password',
    'password.submit': 'Save new password',
    'password.submitting': 'Saving...',
    'password.mismatch': 'The two new passwords do not match.',
    'password.rules': 'At least 8 characters, including one letter and one number.',
    'password.changed': 'Your password has been updated.',

    'nav.dashboard': 'Dashboard',
    'nav.collect': 'Record payment',
    'nav.classwise': 'Class-wise view',
    'nav.defaulters': 'Pending fees',
    'nav.roster': 'Students',
    'nav.structure': 'Fee structure',
    'nav.users': 'Users',
    'nav.audit': 'Activity log',
    'nav.changePassword': 'Change password',
    'nav.signOut': 'Sign out',
    'nav.menu': 'Menu',

    'role.admin': 'Administrator',
    'role.operator': 'Data entry',

    'dash.greeting': 'Welcome',
    'dash.intro': 'Record tuition fee payments and check who has paid.',
    'dash.soon': 'Soon',
    'dash.setup': 'Setup status',
    'dash.setupOk': 'Connected to the fee spreadsheet.',
    'dash.setupProblem': 'The fee spreadsheet needs attention.',
    'dash.setupChecking': 'Checking the spreadsheet connection...',

    'soon.heading': 'Not built yet',
    'soon.body': 'This screen is part of a later phase of the rollout. It will appear here once it is ready.',

    'common.loading': 'Loading...',
    'common.backToDashboard': 'Back to dashboard',
    'common.theme': 'Switch theme',
    'common.language': 'Switch language',
    'common.notFound': 'That page does not exist.',
  },

  hi: {
    'app.name': 'शुल्क रजिस्टर',
    'app.school': 'एस.एन.एस. शिक्षा निकेतन',
    'app.tagline': 'ट्यूशन शुल्क रिकॉर्ड',

    'login.heading': 'साइन इन करें',
    'login.subheading': 'व्यवस्थापक द्वारा दिए गए यूज़रनेम और पासवर्ड का उपयोग करें।',
    'login.username': 'यूज़रनेम',
    'login.password': 'पासवर्ड',
    'login.submit': 'साइन इन करें',
    'login.submitting': 'साइन इन हो रहा है...',
    'login.noAccount': 'खाते व्यवस्थापक द्वारा बनाए जाते हैं। स्वयं पंजीकरण उपलब्ध नहीं है।',
    'login.showPassword': 'पासवर्ड दिखाएँ',
    'login.hidePassword': 'पासवर्ड छिपाएँ',

    'password.heading': 'नया पासवर्ड सेट करें',
    'password.firstTime': 'यह आपका पहला साइन-इन है, आगे बढ़ने से पहले अपना पासवर्ड चुनें।',
    'password.routine': 'अपने खाते के लिए नया पासवर्ड चुनें।',
    'password.current': 'वर्तमान पासवर्ड',
    'password.new': 'नया पासवर्ड',
    'password.confirm': 'नए पासवर्ड की पुष्टि करें',
    'password.submit': 'नया पासवर्ड सहेजें',
    'password.submitting': 'सहेजा जा रहा है...',
    'password.mismatch': 'दोनों नए पासवर्ड मेल नहीं खाते।',
    'password.rules': 'कम से कम 8 अक्षर, जिसमें एक अक्षर और एक अंक हो।',
    'password.changed': 'आपका पासवर्ड बदल दिया गया है।',

    'nav.dashboard': 'डैशबोर्ड',
    'nav.collect': 'भुगतान दर्ज करें',
    'nav.classwise': 'कक्षा-वार विवरण',
    'nav.defaulters': 'बकाया शुल्क',
    'nav.roster': 'विद्यार्थी',
    'nav.structure': 'शुल्क संरचना',
    'nav.users': 'उपयोगकर्ता',
    'nav.audit': 'गतिविधि लॉग',
    'nav.changePassword': 'पासवर्ड बदलें',
    'nav.signOut': 'साइन आउट',
    'nav.menu': 'मेन्यू',

    'role.admin': 'व्यवस्थापक',
    'role.operator': 'डेटा एंट्री',

    'dash.greeting': 'स्वागत है',
    'dash.intro': 'ट्यूशन शुल्क भुगतान दर्ज करें और देखें किसने भुगतान किया है।',
    'dash.soon': 'जल्द',
    'dash.setup': 'सेटअप स्थिति',
    'dash.setupOk': 'शुल्क स्प्रेडशीट से जुड़ा हुआ है।',
    'dash.setupProblem': 'शुल्क स्प्रेडशीट पर ध्यान देने की आवश्यकता है।',
    'dash.setupChecking': 'स्प्रेडशीट कनेक्शन जाँचा जा रहा है...',

    'soon.heading': 'अभी तैयार नहीं',
    'soon.body': 'यह स्क्रीन अगले चरण का हिस्सा है। तैयार होने पर यहाँ दिखाई देगी।',

    'common.loading': 'लोड हो रहा है...',
    'common.backToDashboard': 'डैशबोर्ड पर वापस',
    'common.theme': 'थीम बदलें',
    'common.language': 'भाषा बदलें',
    'common.notFound': 'यह पृष्ठ मौजूद नहीं है।',
  },
};
