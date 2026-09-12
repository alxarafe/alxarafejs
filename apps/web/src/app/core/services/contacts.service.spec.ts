import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { ContactsService } from './contacts.service';

describe('ContactsService', () => {
  let service: ContactsService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(ContactsService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('adds an address to a contact', () => {
    let captured: unknown;
    service.addAddress(5, { street: 'Calle', city: 'Madrid', country: 'ES' }).subscribe((res) => (captured = res));

    const req = http.expectOne('/api/contacts/5/addresses');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ street: 'Calle', city: 'Madrid', country: 'ES' });
    req.flush({ success: true, message: 'Address added', responseObject: { id: 1 }, statusCode: 201 });

    expect((captured as { responseObject: { id: number } })?.responseObject?.id).toBe(1);
  });

  it('removes an address from a contact', () => {
    let done = false;
    service.removeAddress(5, 9).subscribe(() => (done = true));

    const req = http.expectOne('/api/contacts/5/addresses/9');
    expect(req.request.method).toBe('DELETE');
    req.flush({ success: true, message: 'Address deleted', responseObject: null, statusCode: 200 });

    expect(done).toBeTrue();
  });

  it('adds a channel to a contact', () => {
    service.addChannel(5, { channelTypeName: 'email', value: 'a@b.com' }).subscribe();

    const req = http.expectOne('/api/contacts/5/channels');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ channelTypeName: 'email', value: 'a@b.com' });
    req.flush({ success: true, message: 'Channel added', responseObject: { id: 1 }, statusCode: 201 });
  });

  it('removes a channel from a contact', () => {
    let done = false;
    service.removeChannel(5, 9).subscribe(() => (done = true));

    const req = http.expectOne('/api/contacts/5/channels/9');
    expect(req.request.method).toBe('DELETE');
    req.flush({ success: true, message: 'Channel deleted', responseObject: null, statusCode: 200 });

    expect(done).toBeTrue();
  });
});