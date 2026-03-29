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
  if (customer.deleteRequest?.status === 'pending') return false;

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
  if (customer.deleteRequest?.status === 'pending') return false;

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

if (customer.deleteRequest?.status === 'pending') {
  return null;
}

return customer;
  }

  const foundCustomer = runtimeCustomers.find(customer =>
  customer.companyId === runtimeContext.companyId &&
  customer.id === cleanId
);

if (!foundCustomer) {
  return null;
}

if (foundCustomer.deleteRequest?.status === 'pending') {
  return null;
}

return foundCustomer;
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
async function requestCustomerDelete(customerId = '') {
  requireCompanyId();

  const cleanCustomerId = String(customerId || '').trim();

  if (!cleanCustomerId) {
    throw new Error('Missing customerId for delete request.');
  }

  const now = new Date().toISOString();

  if (runtimeContext.storageMode === 'cloud') {
    const customersRef = getCustomersCollectionRef();
    const customerDocRef = customersRef.doc(cleanCustomerId);
    const customerSnapshot = await customerDocRef.get();

    if (!customerSnapshot.exists) {
      throw new Error('Customer not found for delete request.');
    }

    const existingData = customerSnapshot.data() || {};
    const existingDeleteRequest = existingData.deleteRequest || {};

    if (existingDeleteRequest.status === 'pending') {
      return {
        ok: true,
        customerId: cleanCustomerId,
        status: 'pending',
        requestedAt: existingDeleteRequest.requestedAt || now,
        requestedBy: existingDeleteRequest.requestedBy || ''
      };
    }

    await customerDocRef.set(
      {
        deleteRequest: {
          status: 'pending',
          requestedAt: now,
          requestedBy: runtimeContext.userId || ''
        },
        updatedAt: now,
        updatedBy: runtimeContext.userId || ''
      },
      { merge: true }
    );

    const auditLogsRef = getAuditLogsCollectionRef();
    await auditLogsRef.add({
      action: 'requestDeleteCustomer',
      customerId: cleanCustomerId,
      companyId: runtimeContext.companyId,
      userId: runtimeContext.userId || '',
      createdAt: now
    });

 return {
  ok: true,
  customerId: cleanCustomerId,
  customerName: existingData.name || '',
  status: 'pending',
  requestedAt: now,
  requestedBy: runtimeContext.userId || ''
};
  }

  const existingCustomer = runtimeCustomers.find(customer =>
    customer.companyId === runtimeContext.companyId &&
    customer.id === cleanCustomerId
  );

  if (!existingCustomer) {
    throw new Error('Customer not found for delete request.');
  }

  const existingDeleteRequest = existingCustomer.deleteRequest || {};

  if (existingDeleteRequest.status === 'pending') {
    return {
      ok: true,
      customerId: cleanCustomerId,
      status: 'pending',
      requestedAt: existingDeleteRequest.requestedAt || now,
      requestedBy: existingDeleteRequest.requestedBy || ''
    };
  }

  existingCustomer.deleteRequest = {
    status: 'pending',
    requestedAt: now,
    requestedBy: runtimeContext.userId || ''
  };
  existingCustomer.updatedAt = now;
  existingCustomer.updatedBy = runtimeContext.userId || '';

  return {
    ok: true,
    customerId: cleanCustomerId,
    status: 'pending',
    requestedAt: now,
    requestedBy: runtimeContext.userId || ''
  };
}

async function listCustomersAlphabetically() {
  requireCompanyId();

  const normalizeName = (value = '') =>
    String(value || '').trim().toLocaleLowerCase();

  if (runtimeContext.storageMode === 'cloud') {
    const customersRef = getCustomersCollectionRef();
    const snapshot = await customersRef.get();

    return snapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() }))
      .filter(customer => {
        if (customer.isActive === false) return false;
        if (customer.deleteRequest?.status === 'pending') return false;
        return true;
      })
      .sort((a, b) => {
        const nameCompare = normalizeName(a.name).localeCompare(normalizeName(b.name));
        if (nameCompare !== 0) return nameCompare;
        return String(a.id || '').localeCompare(String(b.id || ''));
      });
  }

  return runtimeCustomers
    .filter(customer => {
      if (customer.companyId !== runtimeContext.companyId) return false;
      if (customer.isActive === false) return false;
      if (customer.deleteRequest?.status === 'pending') return false;
      return true;
    })
    .sort((a, b) => {
      const nameCompare = normalizeName(a.name).localeCompare(normalizeName(b.name));
      if (nameCompare !== 0) return nameCompare;
      return String(a.id || '').localeCompare(String(b.id || ''));
    });
}

return {
  createEmptyCustomer,
  setRuntimeContext,
  getRuntimeContext,
  searchCustomers,
  listCustomersAlphabetically,
  getCustomerById,
  saveCustomer,
  requestCustomerDelete
};
})();