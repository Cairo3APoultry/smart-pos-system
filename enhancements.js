/* Smart POS enhancement layer v2 — browser-only demonstration.
   Do not use for live accounting or concurrent tills. */
'use strict';
const POSX = (() => {
  const money2 = n => Number(n||0).toFixed(2);
  const csvEscape = v => '"'+String(v??'').replace(/"/g,'""')+'"';
  const csvLine = a => a.map(csvEscape).join(',');
  const downloadCSV = (name, rows) => download(name,'\ufeff'+rows.map(csvLine).join('\r\n'),'text/csv;charset=utf-8');
  function parseCSV(input) {
    const out=[];let row=[],cell='',quoted=false;
    for(let i=0;i<input.length;i++){const c=input[i];
      if(c==='"'){if(quoted&&input[i+1]==='"'){cell+='"';i++}else quoted=!quoted}
      else if(c===','&&!quoted){row.push(cell);cell=''}
      else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&input[i+1]==='\n')i++;row.push(cell);if(row.some(x=>x.trim()))out.push(row);row=[];cell=''}
      else cell+=c;
    }
    if(quoted)throw Error('علامات اقتباس غير مكتملة');
    row.push(cell);if(row.some(x=>x.trim()))out.push(row);
    return out;
  }
  function importProducts(file) {
    if(!file)return;
    if(file.size>3e6)return alert('الحد الأقصى 3 ميجابايت');
    const reader=new FileReader();
    reader.onload=()=>{
      try{
        const rows=parseCSV(String(reader.result).replace(/^\uFEFF/,''));
        if(rows.length<2)throw Error('الملف لا يحتوي على أصناف');
        const headers=rows.shift().map(x=>x.trim().toLowerCase());
        const required=['name','barcode','category','cost','price','stock'];
        if(!required.every(h=>headers.includes(h)))throw Error('الأعمدة المطلوبة: '+required.join(', '));
        const staged=[],seen=new Set(),errors=[];
        rows.forEach((r,i)=>{
          const obj=Object.fromEntries(required.map(h=>[h,(r[headers.indexOf(h)]||'').trim()]));
          const name=obj.name,barcode=obj.barcode;
          const cost=Number(obj.cost),price=Number(obj.price),stock=Number(obj.stock);
          if(!name||!barcode||![cost,price,stock].every(Number.isFinite)||[cost,price,stock].some(n=>n<0)||!Number.isInteger(stock)){errors.push('صف '+(i+2));return}
          if(seen.has(barcode)){errors.push('باركود مكرر بالملف: '+barcode);return}
          seen.add(barcode);
          staged.push({name,barcode,category:obj.category||'عام',cost,price,stock});
        });
        if(errors.length)throw Error(errors.slice(0,12).join('، ')+' — لم يتم استيراد أي صف');
        const current=new Map(db.products.filter(p=>p.barcode).map(p=>[p.barcode,p]));
        const added=staged.filter(p=>!current.has(p.barcode)).length;
        const updated=staged.length-added;
        if(!confirm('استيراد '+staged.length+' صنف: '+added+' جديد و'+updated+' تحديث. سيتم استبدال أرصدة الأصناف الموجودة بالأرصدة الموجودة في الملف مع تسجيل فروق المخزون. متابعة؟'))return;
        const date=new Date().toISOString();
        for(const item of staged){
          const old=current.get(item.barcode);
          if(old){const diff=item.stock-old.stock;Object.assign(old,item);if(diff)db.movements.push({id:uid(),date,productId:old.id,qty:diff,reason:'تسوية استيراد CSV'})}
          else{const p={id:uid(),...item};db.products.push(p);if(p.stock)db.movements.push({id:uid(),date,productId:p.id,qty:p.stock,reason:'رصيد افتتاحي من CSV'})}
        }
        save();render();alert('تم الاستيراد: '+added+' جديد، '+updated+' تحديث');
      }catch(e){alert('فشل الاستيراد: '+e.message)}
    };
    reader.readAsText(file,'UTF-8');
  }
  function productsView(){
    const filtered=db.products.filter(p=>(p.name+' '+p.barcode+' '+p.category).toLowerCase().includes((window.posProductFilter||'').toLowerCase()));
    return '<div class="panel"><div class="actions"><button class="primary" onclick="newProduct()">+ صنف جديد</button><button onclick="exportCSV()">تصدير CSV</button><button onclick="document.getElementById(\'productImport\').click()">استيراد CSV</button><button onclick="POSX.template()">تنزيل نموذج استيراد</button><input id="productImport" type="file" accept=".csv,text/csv" style="display:none" onchange="POSX.importProducts(this.files[0]);this.value=\'\'"></div><input placeholder="بحث بالاسم أو الباركود أو التصنيف" value="'+esc(window.posProductFilter||'')+'" oninput="window.posProductFilter=this.value;POSX.refreshProducts()"><p class="muted">الاستيراد يحدّث الأصناف بالباركود، ويُسجل فروق المخزون. راجع البيانات قبل التأكيد.</p><div class="tablewrap"><table><tr><th>الصنف</th><th>الباركود</th><th>التصنيف</th><th>التكلفة</th><th>السعر</th><th>المخزون</th><th></th></tr>'+filtered.map(p=>'<tr><td>'+esc(p.name)+'</td><td>'+esc(p.barcode)+'</td><td>'+esc(p.category)+'</td><td>'+money(p.cost)+'</td><td>'+money(p.price)+'</td><td>'+p.stock+'</td><td><button onclick="editProduct(\''+p.id+'\')">تعديل</button></td></tr>').join('')+'</table></div></div>';
  }
  let purchaseCart=[];
  function purchaseView(){
    const options=db.products.map(p=>'<option value="'+esc(p.id)+'">'+esc(p.name)+' — '+esc(p.barcode)+'</option>').join('');
    const lines=purchaseCart.map((x,i)=>{const p=db.products.find(z=>z.id===x.id);return '<tr><td>'+esc(p?.name||'')+'</td><td><input type="number" min="1" step="1" value="'+x.qty+'" onchange="POSX.editLine('+i+',\'qty\',this.value)" style="width:85px"></td><td><input type="number" min="0" step=".01" value="'+x.cost+'" onchange="POSX.editLine('+i+',\'cost\',this.value)" style="width:105px"></td><td>'+money2(x.qty*x.cost)+'</td><td><button class="danger" onclick="POSX.removeLine('+i+')">حذف</button></td></tr>'}).join('');
    return '<div class="panel"><h3>فاتورة مشتريات متعددة الأصناف</h3><div class="actions"><input id="purchaseSupplier" placeholder="اسم المورد (اختياري)" value="'+esc(window.posSupplierDraft||'')+'" oninput="window.posSupplierDraft=this.value"><select id="purchaseProduct">'+options+'</select><input id="purchaseBarcode" placeholder="أو باركود الصنف"><button onclick="POSX.addPurchaseLine()">إضافة الصنف</button></div><div class="tablewrap"><table><tr><th>الصنف</th><th>الكمية</th><th>تكلفة الوحدة</th><th>الإجمالي</th><th></th></tr>'+lines+'</table></div><h2>الإجمالي: '+money(sum(purchaseCart,x=>x.qty*x.cost))+' ج.م</h2><div class="actions"><button class="primary" '+(!purchaseCart.length?'disabled':'')+' onclick="POSX.commitPurchase()">حفظ واستلام جميع الأصناف</button><button onclick="POSX.clearPurchase()">تفريغ الفاتورة</button><button onclick="POSX.exportPurchases()">تصدير المشتريات CSV</button></div><p class="muted">لا يتم تعديل المخزون إلا عند حفظ الفاتورة كاملة.</p></div><div class="panel"><h3>سجل المشتريات</h3><div class="tablewrap"><table><tr><th>التاريخ</th><th>المورد</th><th>الصنف</th><th>الكمية</th><th>التكلفة</th></tr>'+db.purchases.slice().reverse().map(x=>'<tr><td>'+new Date(x.date).toLocaleString('ar-EG')+'</td><td>'+esc(x.supplier||'—')+'</td><td>'+esc(x.name)+'</td><td>'+x.qty+'</td><td>'+money(x.cost)+'</td></tr>').join('')+'</table></div></div>';
  }
  function addPurchaseLine(){
    const barcode=$('purchaseBarcode').value.trim(),p=db.products.find(x=>barcode?x.barcode===barcode:x.id===$('purchaseProduct').value);
    if(!p)return alert('الباركود غير موجود');
    const old=purchaseCart.find(x=>x.id===p.id);
    old?old.qty++:purchaseCart.push({id:p.id,qty:1,cost:p.cost});
    window.posSupplierDraft=$('purchaseSupplier').value;render();
  }
  function editLine(i,k,v){
    const n=Number(v);
    if(!Number.isFinite(n)||n<0||(k==='qty'&&(!Number.isInteger(n)||n<1))){alert('كمية أو تكلفة غير صحيحة');render();return}
    purchaseCart[i][k]=n;window.posSupplierDraft=$('purchaseSupplier')?.value||'';render();
  }
  function commitPurchase(){
    if(!purchaseCart.length)return;
    if(!purchaseCart.every(x=>Number.isInteger(x.qty)&&x.qty>0&&Number.isFinite(x.cost)&&x.cost>=0&&db.products.some(p=>p.id===x.id)))return alert('تحقق من الأصناف والكميات');
    const supplier=$('purchaseSupplier')?.value.trim()||'',date=new Date().toISOString(),reference='PUR-'+String((db.purchaseHeaders||[]).length+1).padStart(5,'0');
    if(!confirm('تأكيد استلام '+purchaseCart.length+' صنف بقيمة '+money(sum(purchaseCart,x=>x.qty*x.cost))+' ج.م؟'))return;
    db.purchaseHeaders ||= [];
    db.purchaseHeaders.push({id:uid(),reference,date,supplier,total:sum(purchaseCart,x=>x.qty*x.cost)});
    for(const x of purchaseCart){const p=db.products.find(z=>z.id===x.id);p.stock+=x.qty;p.cost=x.cost;db.purchases.push({id:uid(),reference,date,supplier,productId:p.id,name:p.name,qty:x.qty,cost:x.cost});db.movements.push({id:uid(),date,productId:p.id,qty:x.qty,reason:reference})}
    purchaseCart=[];window.posSupplierDraft='';save();render();alert('تم حفظ '+reference+' وتحديث المخزون');
  }
  function salesView(){return '<div class="panel"><div class="actions"><button onclick="POSX.exportSales()">تصدير المبيعات CSV</button><button onclick="POSX.exportSalesItems()">تصدير تفاصيل الفواتير CSV</button></div>'+salesTable(db.sales.slice().reverse())+'</div>'}
  function reportsView(){return reportsOriginal()+'<div class="panel"><h3>تصدير التقارير</h3><div class="actions"><button onclick="POSX.exportSales()">المبيعات CSV</button><button onclick="POSX.exportSalesItems()">تفاصيل المبيعات CSV</button><button onclick="POSX.exportPurchases()">المشتريات CSV</button><button onclick="POSX.exportInventory()">المخزون CSV</button><button onclick="window.print()">طباعة التقرير / PDF</button></div></div>'}
  const reportsOriginal=reports;
  function exportSales(){downloadCSV('sales.csv',[['number','date','total','profit','method'],...db.sales.map(x=>[x.number,x.date,x.total,x.profit,x.method])])}
  function exportSalesItems(){downloadCSV('sale-items.csv',[['invoice','date','product','quantity','price','cost'],...db.sales.flatMap(s=>s.items.map(x=>[s.number,s.date,x.name,x.qty,x.price,x.cost]))])}
  function exportPurchases(){downloadCSV('purchases.csv',[['reference','date','supplier','product','quantity','cost'],...db.purchases.map(x=>[x.reference||'',x.date,x.supplier||'',x.name,x.qty,x.cost])])}
  function exportInventory(){downloadCSV('inventory.csv',[['name','barcode','category','stock','cost','price'],...db.products.map(p=>[p.name,p.barcode,p.category,p.stock,p.cost,p.price])])}
  function template(){downloadCSV('products-import-template.csv',[['name','barcode','category','cost','price','stock'],['منتج تجريبي','1234567890','عام','10','15','20']])}
  function refreshProducts(){const v=$('view');if(v)v.innerHTML=productsView()}
  return {importProducts,template,refreshProducts,addPurchaseLine,editLine,removeLine:i=>{purchaseCart.splice(i,1);render()},clearPurchase:()=>{purchaseCart=[];render()},commitPurchase,exportSales,exportSalesItems,exportPurchases,exportInventory,productsView,purchaseView,salesView,reportsView};
})();
products=POSX.productsView;purchases=POSX.purchaseView;sales=POSX.salesView;reports=POSX.reportsView;
render();
