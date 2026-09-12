import { Component, OnInit, inject, signal } from '@angular/core';

import { ApiError, PaginationMeta } from '../../core/models/api';
import { Address, Channel, Contact, ContactDetail } from '../../core/models/contact';
import { CrudFormComponent } from '../../core/resources/crud-form.component';
import { CrudListComponent } from '../../core/resources/crud-list.component';
import { ResourceConfig } from '../../core/resources/resource.types';
import { ResourceService } from '../../core/resources/resource.service';
import { AuthService } from '../../core/services/auth.service';
import { ContactsService } from '../../core/services/contacts.service';

const contactsResource: ResourceConfig = {
  path: '/api/contacts',
  title: 'Contactos',
  showDetail: true,
  listFields: [
    { name: 'id', label: 'ID', type: 'number' },
    { name: 'name', label: 'Nombre', type: 'text' },
    { name: 'notes', label: 'Notas', type: 'text' },
    { name: 'createdAt', label: 'Creado', type: 'text' },
  ],
  formFields: [
    { name: 'name', label: 'Nombre', type: 'text', required: true, placeholder: 'Nombre completo' },
    { name: 'notes', label: 'Notas', type: 'textarea', placeholder: 'Notas opcionales' },
  ],
};

const addressResource: ResourceConfig = {
  path: '',
  title: 'Dirección',
  listFields: [],
  formFields: [
    { name: 'label', label: 'Etiqueta', type: 'text', placeholder: 'p. ej. Oficina' },
    { name: 'street', label: 'Calle', type: 'text', required: true },
    { name: 'city', label: 'Ciudad', type: 'text', required: true },
    { name: 'state', label: 'Provincia / Estado', type: 'text' },
    { name: 'postalCode', label: 'Código postal', type: 'text' },
    { name: 'country', label: 'País', type: 'text', required: true },
  ],
};

const channelResource: ResourceConfig = {
  path: '',
  title: 'Medio de comunicación',
  listFields: [],
  formFields: [
    { name: 'channelTypeName', label: 'Tipo', type: 'text', required: true, placeholder: 'p. ej. email, phone' },
    { name: 'value', label: 'Valor', type: 'text', required: true },
    { name: 'label', label: 'Etiqueta', type: 'text', placeholder: 'p. ej. personal' },
  ],
};

@Component({
  selector: 'app-contacts',
  imports: [CrudListComponent, CrudFormComponent],
  templateUrl: './contacts.html',
  styleUrl: './contacts.scss',
})
export class ContactsPage implements OnInit {
  private readonly resources = inject(ResourceService);
  private readonly contacts = inject(ContactsService);
  private readonly auth = inject(AuthService);

  readonly config = contactsResource;
  readonly addressConfig = addressResource;
  readonly channelConfig = channelResource;

  readonly rows = signal<Contact[]>([]);
  readonly pagination = signal<PaginationMeta | null>(null);
  readonly editing = signal<Contact | null>(null);
  readonly showForm = signal(false);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  readonly detail = signal<ContactDetail | null>(null);
  readonly showDetail = signal(false);
  readonly detailLoading = signal(false);
  readonly addAddressForm = signal(false);
  readonly addChannelForm = signal(false);

  ngOnInit(): void {
    this.auth.fetchCsrfToken().subscribe();
    this.loadPage(0);
  }

  loadPage(offset: number): void {
    const limit = this.pagination()?.limit ?? 10;
    this.loading.set(true);
    this.error.set(null);
    this.resources.list<Contact>(this.config, { top: limit, skip: offset, count: true }).subscribe({
      next: (res) => {
        this.loading.set(false);
        if (res.success && res.responseObject) {
          this.rows.set(res.responseObject.data);
          this.pagination.set(res.responseObject.pagination);
        } else {
          this.error.set(res.message);
        }
      },
      error: (err: ApiError) => {
        this.loading.set(false);
        this.error.set(err.message);
      },
    });
  }

  newContact(): void {
    this.editing.set(null);
    this.showForm.set(true);
  }

  editContact(row: Record<string, unknown>): void {
    this.editing.set(row as Contact);
    this.showForm.set(true);
  }

  deleteContact(row: Record<string, unknown>): void {
    const id = String(row[this.config.idField ?? 'id']);
    if (!window.confirm('¿Eliminar este registro?')) {
      return;
    }
    this.resources.remove(this.config, id).subscribe({
      next: (res) => {
        if (!res.success) {
          this.error.set(res.message);
        }
        this.showDetail.set(false);
        this.detail.set(null);
        this.loadPage(this.pagination()?.offset ?? 0);
      },
      error: (err: ApiError) => this.error.set(err.message),
    });
  }

  onSaved(values: Record<string, unknown>): void {
    const editing = this.editing();
    const request = editing
      ? this.resources.update<Contact>(this.config, String(editing.id), values)
      : this.resources.create<Contact>(this.config, values);
    request.subscribe({
      next: (res) => {
        this.showForm.set(false);
        this.editing.set(null);
        if (!res.success) {
          this.error.set(res.message);
        }
        this.loadPage(this.pagination()?.offset ?? 0);
        if (this.showDetail()) {
          this.reloadDetail();
        }
      },
      error: (err: ApiError) => this.error.set(err.message),
    });
  }

  onCancel(): void {
    this.showForm.set(false);
    this.editing.set(null);
  }

  viewContact(row: Record<string, unknown>): void {
    const id = String(row[this.config.idField ?? 'id']);
    this.showDetail.set(true);
    this.detailLoading.set(true);
    this.error.set(null);
    this.resources.findById<ContactDetail>(this.config, id).subscribe({
      next: (res) => {
        this.detailLoading.set(false);
        if (res.success && res.responseObject) {
          this.detail.set(res.responseObject);
        } else {
          this.error.set(res.message);
        }
      },
      error: (err: ApiError) => {
        this.detailLoading.set(false);
        this.error.set(err.message);
      },
    });
  }

  closeDetail(): void {
    this.showDetail.set(false);
    this.detail.set(null);
    this.addAddressForm.set(false);
    this.addChannelForm.set(false);
  }

  saveAddress(values: Record<string, unknown>): void {
    const current = this.detail();
    if (!current) {
      return;
    }
    this.contacts.addAddress(current.id, values).subscribe({
      next: (res) => {
        if (res.success) {
          this.addAddressForm.set(false);
          this.reloadDetail();
        } else {
          this.error.set(res.message);
        }
      },
      error: (err: ApiError) => this.error.set(err.message),
    });
  }

  removeAddress(addressId: number): void {
    const current = this.detail();
    if (!current || !window.confirm('¿Eliminar esta dirección?')) {
      return;
    }
    this.contacts.removeAddress(current.id, addressId).subscribe({
      next: (res) => {
        if (res.success) {
          this.reloadDetail();
        } else {
          this.error.set(res.message);
        }
      },
      error: (err: ApiError) => this.error.set(err.message),
    });
  }

  saveChannel(values: Record<string, unknown>): void {
    const current = this.detail();
    if (!current) {
      return;
    }
    this.contacts.addChannel(current.id, values).subscribe({
      next: (res) => {
        if (res.success) {
          this.addChannelForm.set(false);
          this.reloadDetail();
        } else {
          this.error.set(res.message);
        }
      },
      error: (err: ApiError) => this.error.set(err.message),
    });
  }

  removeChannel(channelId: number): void {
    const current = this.detail();
    if (!current || !window.confirm('¿Eliminar este medio de comunicación?')) {
      return;
    }
    this.contacts.removeChannel(current.id, channelId).subscribe({
      next: (res) => {
        if (res.success) {
          this.reloadDetail();
        } else {
          this.error.set(res.message);
        }
      },
      error: (err: ApiError) => this.error.set(err.message),
    });
  }

  private reloadDetail(): void {
    const current = this.detail();
    if (current) {
      this.viewContact(current);
    }
  }
}