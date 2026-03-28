window.ShiftFlowCustomers = (() => {
 let runtimeContext = {
  companyId: '',
  userId: '',
  storageMode: 'runtime',
  db: null
};

let runtimeCustomers = [];

  function createEmptyCustomer() {
    return {
      id: '',
      companyId: '',
      name: '',
      address: '',
      gateCode: '',
      contact: '',
      phone: '',
      website: '',
      driverInstructions: '',
      dropoffInfo: '',
      openingHours: '',
      notes: '',
      mainPhotoUrl: '',
      detailPhotoUrls: [],
      createdAt: '',
      updatedAt: '',
      createdBy: '',
      updatedBy: '',
      isActive: true
    };
  }

 function setRuntimeContext({
  companyId = '',
  userId = '',
  storageMode = 'runtime',
  db = null
} = {}) {
  runtimeContext.companyId = String(companyId || '').trim();
  runtimeContext.userId = String(userId || '').trim();
  runtimeContext.storageMode = String(storageMode || 'runtime').trim() || 'runtime';
  runtimeContext.db = db || null;
}

  function getRuntimeContext() {
    return { ...runtimeContext };
  }

  function requireCompanyId() {
    if (!runtimeContext.companyId) {
      throw new Error('Missing companyId in ShiftFlowCustomers runtime context.');
    }
  }
function getCompanyDocRef() {
  requireCompanyId();

  if (!runtimeContext.db) {
    throw new Error('Missing Firestore db in ShiftFlowCustomers runtime context.');
  }

  return runtimeContext.db
    .collection('companies')
    .doc(runtimeContext.companyId);
}

function getCustomersCollectionRef() {
  return getCompanyDocRef().collection('customers');
}

function getAuditLogsCollectionRef() {
  return getCompanyDocRef().collection('auditLogs');
}

async function searchCustomers(query = '') {
  requireCompanyId();

  const cleanQuery = String(query || '').trim().toLowerCase();

  if (!cleanQuery) return [];

  if (runtimeContext.storageMode === 'cloud') {
    const customersRef = getCustomersCollectionRef();
    const snapshot = await customersRef.get();

    return snapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() }))
      .filter(customer => {
        if (customer.isActive === false) return false;

        const haystack = [
          customer.name,
          customer.address,
          customer.gateCode,
          customer.contact,
          customer.phone,
          customer.website,
          customer.driverInstructions,
          customer.dropoffInfo,
          customer.openingHours,
          customer.notes
        ]
          .join(' ')
          .toLowerCase();

        return haystack.includes(cleanQuery);
      });
  }

  return runtimeCustomers.filter(customer => {
    if (customer.companyId !== runtimeContext.companyId) return false;

    const haystack = [
      customer.name,
      customer.address,
      customer.gateCode,
      customer.contact,
      customer.phone,
      customer.website,
      customer.driverInstructions,
      customer.dropoffInfo,
      customer.openingHours,
      customer.notes
    ]
      .join(' ')
      .toLowerCase();

    return haystack.includes(cleanQuery);
  });
}

async function getCustomerById(customerId = '') {
  requireCompanyId();

  const cleanId = String(customerId || '').trim();

  if (!cleanId) return null;

  if (runtimeContext.storageMode === 'cloud') {
    const customersRef = getCustomersCollectionRef();
    const docSnapshot = await customersRef.doc(cleanId).get();

    if (!docSnapshot.exists) {
      return null;
    }

    const customer = {
      id: docSnapshot.id,
      ...docSnapshot.data()
    };

    if (customer.isActive === false) {
      return null;
    }

    return customer;
  }

  return (
    runtimeCustomers.find(customer =>
      customer.companyId === runtimeContext.companyId &&
      customer.id === cleanId
    ) || null
  );
}

 async function saveCustomer(customerData = {}) {
  requireCompanyId();

  const base = createEmptyCustomer();
  const now = new Date().toISOString();
  const trimmedId = String(customerData.id || '').trim();
  const isUpdate = !!trimmedId;

  const savedRecord = {
    ...base,
    ...customerData,
    id: trimmedId || `cust_${Date.now()}`,
    companyId: runtimeContext.companyId,
    createdAt: isUpdate ? (customerData.createdAt || now) : now,
    updatedAt: now,
    createdBy: isUpdate
      ? (customerData.createdBy || runtimeContext.userId || '')
      : (runtimeContext.userId || ''),
    updatedBy: runtimeContext.userId || '',
    isActive: customerData.isActive !== false
  };

  if (runtimeContext.storageMode === 'cloud') {
    const customersRef = getCustomersCollectionRef();
    await customersRef.doc(savedRecord.id).set(savedRecord);

    const auditLogsRef = getAuditLogsCollectionRef();
    await auditLogsRef.add({
      action: isUpdate ? 'updateCustomer' : 'createCustomer',
      customerId: savedRecord.id,
      companyId: runtimeContext.companyId,
      userId: runtimeContext.userId || '',
      createdAt: now
    });

    return savedRecord;
  }

  const existingIndex = runtimeCustomers.findIndex(customer =>
    customer.companyId === runtimeContext.companyId &&
    customer.id === savedRecord.id
  );

  if (existingIndex >= 0) {
    runtimeCustomers[existingIndex] = savedRecord;
  } else {
    runtimeCustomers.push(savedRecord);
  }

  return savedRecord;
}

return {
  createEmptyCustomer,
  setRuntimeContext,
  getRuntimeContext,
  searchCustomers,
  getCustomerById,
  saveCustomer
};
})();