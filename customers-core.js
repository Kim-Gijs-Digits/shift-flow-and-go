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
  function getCustomersCollectionRef() {
  requireCompanyId();

  if (!runtimeContext.db) {
    throw new Error('Missing Firestore db in ShiftFlowCustomers runtime context.');
  }

  return runtimeContext.db
    .collection('companies')
    .doc(runtimeContext.companyId)
    .collection('customers');
}

async function searchCustomers(query = '') {
  requireCompanyId();

  const cleanQuery = String(query || '').trim().toLowerCase();

  if (!cleanQuery) return [];

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