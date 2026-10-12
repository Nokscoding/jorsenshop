import assert from 'node:assert/strict';
import test from 'node:test';
import {shippingQuote,publicCities,normalizeCity} from './shipping-policy.mjs';
test('four supported cities',()=>assert.deepEqual(publicCities().map(x=>x.name),['Lubumbashi','Likasi','Fungurume','Kolwezi']));
test('Lubumbashi normal COD 7000',()=>assert.deepEqual(
  [shippingQuote('Lubumbashi','normal').deliveryFeeFc,shippingQuote('lubumbashi','normal').paymentRequiredBeforePurchase],[7000,false]));
test('Lubumbashi express COD 15000',()=>assert.deepEqual(
  [shippingQuote('Lubumbashi','express').deliveryFeeFc,shippingQuote('Lubumbashi','express').paymentMethods],[15000,['paiement_livraison']]));
for(const city of ['Likasi','Fungurume','Kolwezi']){
  test(city+' expedition 10000, payment first',()=>{
    const q=shippingQuote(city);
    assert.equal(q.deliveryFeeFc,10000);
    assert.equal(q.paymentRequiredBeforePurchase,true);
    assert.deepEqual(q.paymentMethods,['airtel_money','orange_money']);
    assert.deepEqual(q.agencies,['KKS','NGOKAF']);
    assert.throws(()=>shippingQuote(city,'express'),RangeError);
  });
}
test('reject unknown cities and modes',()=>{
 assert.equal(normalizeCity('Matadi'),null);
 assert.throws(()=>shippingQuote('Matadi','normal'),RangeError);
 assert.throws(()=>shippingQuote('Lubumbashi','expedition'),RangeError);
});
