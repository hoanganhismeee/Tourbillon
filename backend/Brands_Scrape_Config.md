# Jaeger-LeCoultre Configuration

**Status:** ✅ Configured and Active
**Brand ID:** 6
**Target:** ~30 watches across 4 collections (Reverso, Master Ultra Thin, Polaris, Duomètre)

---

## Configuration Summary

**Product Card Selectors:**
- CardContainer: `//a[contains(@class, 'product-card__link')]`
- CollectionName: `.//h5[contains(@class, 'product-card__collection')]`
- Image: `.//img[contains(@class, 'lazyload') or contains(@class, 'lazyloaded')]`
- DetailPageLink: `@href`

**Detail Page Selectors:**
- Price: `//span[@data-price='value']`
- ReferenceNumber: `(//h1[contains(@class, 'product-page-details__title')])[1]`
- CollectionName: `//h1[contains(@class, 'product-page-details__title')]`
- Specs: Feature, Movement, Straps sections via accordion IDs

---

## Website URLs

**Brand Website:**
```
https://www.jaeger-lecoultre.com/au-en
```

**Collection URLs:**
```
https://www.jaeger-lecoultre.com/au-en/watches/reverso
https://www.jaeger-lecoultre.com/au-en/watches/master-ultra-thin
https://www.jaeger-lecoultre.com/au-en/watches/polaris
https://www.jaeger-lecoultre.com/au-en/watches/duometre
```

---

## HTML Selectors (Product Card, Details, Prices, Specs)
Reverso 
<a href="/au-en/watches/reverso/reverso-tribute/reverso-tribute-chronograph-q389257j?algoliaQueryID=c1e89a3336d5b23876b64ceb40a32f27" class="product-card__link" data-tracking="{&quot;event&quot;:&quot;select_item&quot;,&quot;ecommerce&quot;:{&quot;currency&quot;:&quot;AUD&quot;,&quot;items&quot;:[{&quot;currency&quot;:&quot;AUD&quot;,&quot;item_brand&quot;:&quot;jlc&quot;,&quot;item_category&quot;:&quot;watches&quot;,&quot;item_collection&quot;:&quot;Reverso Tribute&quot;,&quot;item_id&quot;:&quot;Q389257J&quot;,&quot;item_line&quot;:&quot;&quot;,&quot;item_name&quot;:&quot;Chronograph&quot;,&quot;item_sellable&quot;:false,&quot;item_variant&quot;:&quot;&quot;,&quot;price&quot;:68000}],&quot;_currency&quot;:{&quot;AU&quot;:&quot;AUD&quot;}}}" data-uw-rm-brl="PR" data-uw-original-href="/au-en/watches/reverso/reverso-tribute/reverso-tribute-chronograph-q389257j?algoliaQueryID=c1e89a3336d5b23876b64ceb40a32f27"><div class="simple-slider product-card__slider" style="pointer-events: auto;"><div class="simple-slider__body"><div class="simple-slider__slide product-card__picture"><div class="picture"><picture><source media="(min-width: 768px)" srcset="https://img.jaeger-lecoultre.com/product-card-md-3/o-dpr-2/2b393be0e6d09f16055dd6d8300de47448c2d03b.jpg 2x, https://img.jaeger-lecoultre.com/product-card-md-3/2b393be0e6d09f16055dd6d8300de47448c2d03b.jpg 1x" data-srcset="https://img.jaeger-lecoultre.com/product-card-md-3/o-dpr-2/2b393be0e6d09f16055dd6d8300de47448c2d03b.jpg 2x, https://img.jaeger-lecoultre.com/product-card-md-3/2b393be0e6d09f16055dd6d8300de47448c2d03b.jpg 1x"><source media="(min-width: 568px)" srcset="https://img.jaeger-lecoultre.com/product-card-sm-3/o-dpr-2/2b393be0e6d09f16055dd6d8300de47448c2d03b.jpg 2x, https://img.jaeger-lecoultre.com/product-card-sm-3/2b393be0e6d09f16055dd6d8300de47448c2d03b.jpg 1x" data-srcset="https://img.jaeger-lecoultre.com/product-card-sm-3/o-dpr-2/2b393be0e6d09f16055dd6d8300de47448c2d03b.jpg 2x, https://img.jaeger-lecoultre.com/product-card-sm-3/2b393be0e6d09f16055dd6d8300de47448c2d03b.jpg 1x"><img src="https://img.jaeger-lecoultre.com/product-card-3/2b393be0e6d09f16055dd6d8300de47448c2d03b.jpg" data-src="https://img.jaeger-lecoultre.com/product-card-3/2b393be0e6d09f16055dd6d8300de47448c2d03b.jpg" data-srcset="https://img.jaeger-lecoultre.com/product-card-3/o-dpr-2/2b393be0e6d09f16055dd6d8300de47448c2d03b.jpg 2x, https://img.jaeger-lecoultre.com/product-card-3/2b393be0e6d09f16055dd6d8300de47448c2d03b.jpg 1x" class=" lazyloaded" alt="A stylish rectangular watch with a black dial, gold accents, and a black strap. Elegant and sophisticated design." srcset="https://img.jaeger-lecoultre.com/product-card-3/o-dpr-2/2b393be0e6d09f16055dd6d8300de47448c2d03b.jpg 2x, https://img.jaeger-lecoultre.com/product-card-3/2b393be0e6d09f16055dd6d8300de47448c2d03b.jpg 1x" data-uw-rm-alt-original="" data-uw-rm-alt="BE"></picture></div></div><div class="simple-slider__slide product-card__picture"><div class="picture"><picture><source media="(min-width: 768px)" srcset="https://img.jaeger-lecoultre.com/product-card-md-3/o-dpr-2/28e96acde68963914c52ee5285c544fc8e7d6b9e.jpg 2x, https://img.jaeger-lecoultre.com/product-card-md-3/28e96acde68963914c52ee5285c544fc8e7d6b9e.jpg 1x" data-srcset="https://img.jaeger-lecoultre.com/product-card-md-3/o-dpr-2/28e96acde68963914c52ee5285c544fc8e7d6b9e.jpg 2x, https://img.jaeger-lecoultre.com/product-card-md-3/28e96acde68963914c52ee5285c544fc8e7d6b9e.jpg 1x"><source media="(min-width: 568px)" srcset="https://img.jaeger-lecoultre.com/product-card-sm-3/o-dpr-2/28e96acde68963914c52ee5285c544fc8e7d6b9e.jpg 2x, https://img.jaeger-lecoultre.com/product-card-sm-3/28e96acde68963914c52ee5285c544fc8e7d6b9e.jpg 1x" data-srcset="https://img.jaeger-lecoultre.com/product-card-sm-3/o-dpr-2/28e96acde68963914c52ee5285c544fc8e7d6b9e.jpg 2x, https://img.jaeger-lecoultre.com/product-card-sm-3/28e96acde68963914c52ee5285c544fc8e7d6b9e.jpg 1x"><img src="https://img.jaeger-lecoultre.com/product-card-3/28e96acde68963914c52ee5285c544fc8e7d6b9e.jpg" data-src="https://img.jaeger-lecoultre.com/product-card-3/28e96acde68963914c52ee5285c544fc8e7d6b9e.jpg" data-srcset="https://img.jaeger-lecoultre.com/product-card-3/o-dpr-2/28e96acde68963914c52ee5285c544fc8e7d6b9e.jpg 2x, https://img.jaeger-lecoultre.com/product-card-3/28e96acde68963914c52ee5285c544fc8e7d6b9e.jpg 1x" class=" lazyloaded" alt="A luxury rectangular watch with a transparent face, gold accents, and a black leather strap." srcset="https://img.jaeger-lecoultre.com/product-card-3/o-dpr-2/28e96acde68963914c52ee5285c544fc8e7d6b9e.jpg 2x, https://img.jaeger-lecoultre.com/product-card-3/28e96acde68963914c52ee5285c544fc8e7d6b9e.jpg 1x" data-uw-rm-alt-original="" data-uw-rm-alt="BE"></picture></div></div><div class="simple-slider__slide product-card__picture"><div class="picture"><picture><source media="(min-width: 768px)" srcset="https://img.jaeger-lecoultre.com/product-card-md-3/o-dpr-2/ec4768efa6e0141a571f7a5d0cdf2df6131317d3.jpg 2x, https://img.jaeger-lecoultre.com/product-card-md-3/ec4768efa6e0141a571f7a5d0cdf2df6131317d3.jpg 1x" data-srcset="https://img.jaeger-lecoultre.com/product-card-md-3/o-dpr-2/ec4768efa6e0141a571f7a5d0cdf2df6131317d3.jpg 2x, https://img.jaeger-lecoultre.com/product-card-md-3/ec4768efa6e0141a571f7a5d0cdf2df6131317d3.jpg 1x"><source media="(min-width: 568px)" srcset="https://img.jaeger-lecoultre.com/product-card-sm-3/o-dpr-2/ec4768efa6e0141a571f7a5d0cdf2df6131317d3.jpg 2x, https://img.jaeger-lecoultre.com/product-card-sm-3/ec4768efa6e0141a571f7a5d0cdf2df6131317d3.jpg 1x" data-srcset="https://img.jaeger-lecoultre.com/product-card-sm-3/o-dpr-2/ec4768efa6e0141a571f7a5d0cdf2df6131317d3.jpg 2x, https://img.jaeger-lecoultre.com/product-card-sm-3/ec4768efa6e0141a571f7a5d0cdf2df6131317d3.jpg 1x"><img src="https://img.jaeger-lecoultre.com/product-card-3/ec4768efa6e0141a571f7a5d0cdf2df6131317d3.jpg" data-src="https://img.jaeger-lecoultre.com/product-card-3/ec4768efa6e0141a571f7a5d0cdf2df6131317d3.jpg" data-srcset="https://img.jaeger-lecoultre.com/product-card-3/o-dpr-2/ec4768efa6e0141a571f7a5d0cdf2df6131317d3.jpg 2x, https://img.jaeger-lecoultre.com/product-card-3/ec4768efa6e0141a571f7a5d0cdf2df6131317d3.jpg 1x" class=" lazyloaded" alt="A stylish rectangular watch with a black dial, gold accents, and a black leather strap." srcset="https://img.jaeger-lecoultre.com/product-card-3/o-dpr-2/ec4768efa6e0141a571f7a5d0cdf2df6131317d3.jpg 2x, https://img.jaeger-lecoultre.com/product-card-3/ec4768efa6e0141a571f7a5d0cdf2df6131317d3.jpg 1x" data-uw-rm-alt-original="" data-uw-rm-alt="BE"></picture></div></div></div><div class="product-card__slider-pagination"><span class="simple-slider__pagination-bullet simple-slider__pagination-bullet--active"></span><span class="simple-slider__pagination-bullet"></span><span class="simple-slider__pagination-bullet"></span></div></div><div class="product-card__body"><div class="product-card__details"><div class="product-card__tags" data-cy="product-tags"><span class="tag product-card__tag">Exclusivity</span></div><h5 class="product-card__collection" role="heading" aria-level="4" data-uw-rm-heading="level">Reverso Tribute</h5><h5 class="product-card__name">Chronograph</h5><div class="product-card__specs">49.4 x 29.9 mm Manual Pink Gold Chronograph Watch</div><div class="product-price product-card__price product-price--thin product-price--small"><span currencycode="AUD"><span data-price="currency" class="" data-cy="price-currency">AU$</span> <span data-price="value">68,000</span></span></div></div></div></a>

Image
<div class="product-images-grid__item-container">
                    <button class="picture picture--actionable picture--contain lightbox-trigger" data-lightbox-open="product-light-box-6928110761193" data-lightbox-index="1">
                <figure class="figure " role="figure" data-uw-rm-br-ar-ref-lb="" data-uw-rm-sr="" data-uw-rm-br-ar-ref-ids-aria-labelledby="figure-caption-69281108761850.10356811">
    <picture>
                                    <source srcset="https://img.jaeger-lecoultre.com/product-grid-hero-xl-4/o-dpr-2/2b393be0e6d09f16055dd6d8300de47448c2d03b.jpg 2x, https://img.jaeger-lecoultre.com/product-grid-hero-xl-4/2b393be0e6d09f16055dd6d8300de47448c2d03b.jpg 1x" media="(min-width: 1280px)">
                            <source srcset="https://img.jaeger-lecoultre.com/product-grid-hero-lg-4/o-dpr-2/2b393be0e6d09f16055dd6d8300de47448c2d03b.jpg 2x, https://img.jaeger-lecoultre.com/product-grid-hero-lg-4/2b393be0e6d09f16055dd6d8300de47448c2d03b.jpg 1x" media="(min-width: 1024px)">
            
            <img src="https://img.jaeger-lecoultre.com/product-grid-hero-4/2b393be0e6d09f16055dd6d8300de47448c2d03b.jpg" alt="Front product image of the watch Q389257J" srcset="https://img.jaeger-lecoultre.com/product-grid-hero-4/o-dpr-2/2b393be0e6d09f16055dd6d8300de47448c2d03b.jpg 2x, https://img.jaeger-lecoultre.com/product-grid-hero-4/2b393be0e6d09f16055dd6d8300de47448c2d03b.jpg 1x" class="img-block " data-uw-rm-alt-original="Front product image of the watch Q389257J" data-uw-rm-alt="ALT">
            </picture>

    </figure>
            </button>
        
            </div>

Price, Specs
<div class="product-page-details__infos" data-cy="product-page-details-top">
                        <div class="hidden md:block">
                            <div class="product-page-details__tags" data-cy="product-tags">
                    <span class="tag product-page-details__tag">Exclusivity</span>
            </div>

<div class="product-page-details__title-price-wrapper">
    <h1 class="product-page-details__title h3" role="heading" aria-level="2" data-uw-rm-heading="level">
        Reverso Tribute<br>
        <span class="product-page-details__subtitle">Chronograph</span>
    </h1>

            <div class="product-price country-reveal-container">
            <span class="price-from--prices "><span data-country-code="AU" class=""><span class="product-price__value">
                    <span data-price="currency" class="">AU$</span>
            <span data-price="value">68,000</span>
            </span>

            <span class="product-price__vat hidden">Price including taxes</span>
    </span></span>
        </div>
    </div>


    <div class="product-page-details__resume text--muted">
        <span class="block">49.4 x 29.9 mm Manual Pink Gold Chronograph Watch</span>

            </div>
                        </div>

                        <div class="btn-grid--xs mb-sm country-reveal-container" data-cy="product-cta-container">
                                                            <a type="button" href="https://www.jaeger-lecoultre.com/au-en/light-checkout?reference=Q389257J" class="btn btn--default btn--full btn--icon btn--negative " data-cy="light-ecom-btn" data-tracking="{&quot;event&quot;:&quot;order_online_form&quot;,&quot;ecommerce&quot;:{&quot;currency&quot;:&quot;AUD&quot;,&quot;userstatus&quot;:&quot;guest&quot;,&quot;items&quot;:[{&quot;item_id&quot;:&quot;Q389257J&quot;,&quot;item_name&quot;:&quot;Chronograph&quot;,&quot;item_brand&quot;:&quot;jlc&quot;,&quot;item_category&quot;:&quot;Watches&quot;,&quot;item_collection&quot;:&quot;Reverso Tribute&quot;,&quot;item_sellable&quot;:&quot;notsellable&quot;,&quot;currency&quot;:&quot;AUD&quot;,&quot;price&quot;:&quot;68000.00&quot;,&quot;item_variant&quot;:&quot;&quot;,&quot;item_line&quot;:&quot;&quot;}]}}" data-product-reference="Q389257J" data-base-model-reference="Q389257J" data-algolia-insights="{&quot;objectIDs&quot;:[&quot;Page::3586&quot;],&quot;index&quot;:&quot;products&quot;,&quot;eventName&quot;:&quot;Product added to Cart&quot;,&quot;type&quot;:&quot;addToCart&quot;}" data-uw-rm-brl="PR" data-uw-original-href="https://www.jaeger-lecoultre.com/au-en/light-checkout?reference=Q389257J" aria-label="Pre-order now" data-uw-rm-empty-ctrl="">
        <span class="btn__text" data-uw-trigger="" data-uw-ignore-s25="" aria-haspopup="dialog">Pre-order now</span>

                    <span class="btn__icon pointer-events-none">
                <svg class="icon icon--cart-16 " aria-hidden="true" focusable="false" role="img" data-uw-rm-br-ar-ref-lb="" data-uw-rm-sr="" data-uw-rm-br-ar-ref-ids-aria-labelledby="icon-69281108782570000">
                <use href="https://www.jaeger-lecoultre.com/jlc/dist/assets/icons.svg?cacheKey=b81f1f6a799799d00514031b7b625ae3#cart-16"></use>
    </svg>
            </span>
            </a>



                                                                    <a href="tel:+61 2 8663 8028" type="button" class="btn btn--default btn--icon btn--full" data-cy="shop-by-phone-btn" data-country-code="AU" data-tracking="{&quot;event&quot;:&quot;call_center&quot;,&quot;button_position&quot;:&quot;product_page&quot;,&quot;button_type&quot;:&quot;buy&quot;,&quot;items&quot;:[{&quot;item_id&quot;:&quot;Q389257J&quot;,&quot;item_name&quot;:&quot;Chronograph&quot;,&quot;item_brand&quot;:&quot;jlc&quot;,&quot;item_category&quot;:&quot;Watches&quot;,&quot;item_collection&quot;:&quot;Reverso Tribute&quot;,&quot;item_sellable&quot;:&quot;notsellable&quot;,&quot;currency&quot;:&quot;AUD&quot;,&quot;price&quot;:&quot;68000.00&quot;,&quot;item_variant&quot;:&quot;&quot;,&quot;item_line&quot;:&quot;&quot;}]}" data-algolia-insights="{&quot;objectIDs&quot;:[&quot;Page::3586&quot;],&quot;index&quot;:&quot;products&quot;,&quot;eventName&quot;:&quot;Product converted&quot;,&quot;type&quot;:&quot;conversion&quot;}" aria-label="call +61 2 8663 8028" data-uw-rm-vglnk="" uw-rm-vague-link-id="tel:+61 2 8663 8028$call +61 2 8663 8028">
        <span class="btn__text" data-uw-trigger="" data-uw-ignore-s25="" aria-haspopup="dialog">Inquire by phone</span>

                    <span class="btn__icon pointer-events-none">
                <svg class="icon icon--phone-16 " aria-hidden="true" focusable="false" role="img" data-uw-rm-br-ar-ref-lb="" data-uw-rm-sr="" data-uw-rm-br-ar-ref-ids-aria-labelledby="icon-69281108782f40000">
                <use href="https://www.jaeger-lecoultre.com/jlc/dist/assets/icons.svg?cacheKey=b81f1f6a799799d00514031b7b625ae3#phone-16"></use>
    </svg>
            </span>
            </a>
                                
                                
                                <a href="https://www.jaeger-lecoultre.com/au-en/boutique-appointment?reference=Q389257J" type="button" class="btn btn--default btn--full btn--icon" data-tracking="{&quot;event&quot;:&quot;baa_selected&quot;,&quot;boutique_id&quot;:null}" data-algolia-insights="{&quot;objectIDs&quot;:[&quot;Page::3586&quot;],&quot;index&quot;:&quot;products&quot;,&quot;eventName&quot;:&quot;Product converted&quot;,&quot;type&quot;:&quot;conversion&quot;}" data-uw-rm-brl="PR" data-uw-original-href="https://www.jaeger-lecoultre.com/au-en/boutique-appointment?reference=Q389257J" aria-label="Book an appointment" data-uw-rm-empty-ctrl="">
    <span class="btn__text" data-uw-trigger="" data-uw-ignore-s25="" aria-haspopup="dialog">Book an appointment</span>
    <span class="btn__icon pointer-events-none">
        <svg class="icon icon--clock-16 " aria-hidden="true" focusable="false" role="img" data-uw-rm-br-ar-ref-lb="" data-uw-rm-sr="" data-uw-rm-br-ar-ref-ids-aria-labelledby="icon-69281108783750000">
                <use href="https://www.jaeger-lecoultre.com/jlc/dist/assets/icons.svg?cacheKey=b81f1f6a799799d00514031b7b625ae3#clock-16"></use>
    </svg>
    </span>
</a>

                                <a href="https://wa.me/+61483905200" target="_blank" type="button" data-tracking="{&quot;event&quot;:&quot;whatsapp&quot;,&quot;items&quot;:[{&quot;item_id&quot;:&quot;Q389257J&quot;,&quot;item_name&quot;:&quot;Chronograph&quot;,&quot;item_brand&quot;:&quot;jlc&quot;,&quot;item_category&quot;:&quot;Watches&quot;,&quot;item_collection&quot;:&quot;Reverso Tribute&quot;,&quot;item_sellable&quot;:&quot;notsellable&quot;,&quot;currency&quot;:&quot;AUD&quot;,&quot;price&quot;:&quot;68000.00&quot;,&quot;item_variant&quot;:&quot;&quot;,&quot;item_line&quot;:&quot;&quot;}]}" class="btn btn--default btn--full" data-algolia-insights="{&quot;objectIDs&quot;:[&quot;Page::3586&quot;],&quot;index&quot;:&quot;products&quot;,&quot;eventName&quot;:&quot;Product converted&quot;,&quot;type&quot;:&quot;conversion&quot;}" data-uw-rm-brl="PR" data-uw-original-href="https://wa.me/+61483905200" aria-label="WhatsApp - open in a new tab" data-uw-rm-empty-ctrl="" data-uw-rm-ext-link="" uw-rm-external-link-id="https://wa.me/+61483905200$whatsapp">
        <span class="btn__text" data-uw-trigger="" data-uw-ignore-s25="" aria-haspopup="dialog">WhatsApp</span>
        <span class="btn__icon pointer-events-none">
            <svg class="icon icon--whatsapp-16 " aria-hidden="true" focusable="false" role="img" data-uw-rm-br-ar-ref-lb="" data-uw-rm-sr="" data-uw-rm-br-ar-ref-ids-aria-labelledby="icon-6928110878b010000">
                <use href="https://www.jaeger-lecoultre.com/jlc/dist/assets/icons.svg?cacheKey=b81f1f6a799799d00514031b7b625ae3#whatsapp-16"></use>
    </svg>
        </span>
    </a>

                                
                                                                    <span id="show-sticky-add-to-bag"></span>
                                                                                    </div>

                        
                        
                        <ul class="accordion menu menu--border-full-width product-page-details__description-accordion">
    
    <li class="menu__item accordion__item">
    <button class="accordion__title menu__entry menu__link menu__toggle accordion__toggle " data-toggle="collapse" data-target="#product-accordion-tab-description" aria-expanded="false">
        Description
        <svg class="icon icon--chevron-down-10 icon--12" focusable="false" aria-labelledby="icon-692811087934b0000" role="img">
                    <title id="icon-692811087934b0000">Description</title>
                <use href="https://www.jaeger-lecoultre.com/jlc/dist/assets/icons.svg?cacheKey=b81f1f6a799799d00514031b7b625ae3#chevron-down-10"></use>
    </svg>
    </button>

            <div id="product-accordion-tab-description" class="accordion__content collapse">
            
                <div class="product-page-details__infos_text">
            <p>Exceptional complication reinvented. This is the promise of the new Reverso Tribute Chronograph, which features an hour-minute display on its two dials with contrasting and complementary styles. The front dial soberly displays the aesthetic codes of the Tribute line: gadroons, “railroad” minute track, applied hour-markers and Dauphine hands stand out against the sunray black dial. Once turned over on its cradle, the watch reveals a meticulously crafted open-worked reverse that unveils every detail of the new Manufacture Calibre 860 and the formidable mechanics of the retrograde chronograph: hour markers and minute track that seem to float above the movement, blue hands, bevelled bridges, Côtes de Genève… in leather or bi-material (leather/canvas), two interchangeable straps in Casa Fagliano design provide the watch with either a natural or a more sophisticated look.</p>
        </div>

                
                    </div>
    </li>

    
    <li class="menu__item accordion__item">
    <button class="accordion__title menu__entry menu__link menu__toggle accordion__toggle " data-toggle="collapse" data-target="#product-accordion-tab-feature" aria-expanded="false">
        Features
        <svg class="icon icon--chevron-down-10 icon--12" focusable="false" aria-labelledby="icon-69281108797fb0000" role="img">
                    <title id="icon-69281108797fb0000">Features</title>
                <use href="https://www.jaeger-lecoultre.com/jlc/dist/assets/icons.svg?cacheKey=b81f1f6a799799d00514031b7b625ae3#chevron-down-10"></use>
    </svg>
    </button>

            <div id="product-accordion-tab-feature" class="accordion__content collapse">
            
                <div class="product-page-details__infos_start" data-tooltip-key="ProductPage.specification.case.tooltip">
                <h3 class="product-page-details__infos_subtitle">Case</h3>
                            </div>

            <div class="product-page-details__infos_text">
                                    Pink Gold 750/1000 (18 carats) <br>                                    Dimensions (L x W): 49.4 x 29.9 mm, L : Lug to lug <br>                                    Thickness: 11.14mm                             </div>
                    <div class="product-page-details__infos_start" data-tooltip-key="ProductPage.specification.waterResistance.tooltip">
                <h3 class="product-page-details__infos_subtitle">Water resistance</h3>
                            </div>

            <div class="product-page-details__infos_text">
                                    3 bar                             </div>
                    <div class="product-page-details__infos_start" data-tooltip-key="ProductPage.specification.rectoDial.tooltip">
                <h3 class="product-page-details__infos_subtitle">Recto dial</h3>
                            </div>

            <div class="product-page-details__infos_text">
                                    Appliqued hour-markers, Black, sunray-brushed                             </div>
                    <div class="product-page-details__infos_start" data-tooltip-key="ProductPage.specification.versoDial.tooltip">
                <h3 class="product-page-details__infos_subtitle">Verso dial</h3>
                            </div>

            <div class="product-page-details__infos_text">
                                    Appliqued hour-markers, Golden 4n, Opaline                             </div>
                    <div class="product-page-details__infos_start" data-tooltip-key="ProductPage.specification.rectoHands.tooltip">
                <h3 class="product-page-details__infos_subtitle">Recto hands</h3>
                            </div>

            <div class="product-page-details__infos_text">
                                    Dauphines                             </div>
                    <div class="product-page-details__infos_start" data-tooltip-key="ProductPage.specification.versoHands.tooltip">
                <h3 class="product-page-details__infos_subtitle">Verso hands</h3>
                            </div>

            <div class="product-page-details__infos_text">
                                    Dauphines                             </div>

                
                    </div>
    </li>


            
        <li class="menu__item accordion__item">
    <button class="accordion__title menu__entry menu__link menu__toggle accordion__toggle " data-toggle="collapse" data-target="#product-accordion-tab-movement" aria-expanded="false">
        Movement
        <svg class="icon icon--chevron-down-10 icon--12" focusable="false" aria-labelledby="icon-692811087bc080000" role="img">
                    <title id="icon-692811087bc080000">Movement</title>
                <use href="https://www.jaeger-lecoultre.com/jlc/dist/assets/icons.svg?cacheKey=b81f1f6a799799d00514031b7b625ae3#chevron-down-10"></use>
    </svg>
    </button>

            <div id="product-accordion-tab-movement" class="accordion__content collapse">
            
                <div class="mb-sm text-center bg-media">
                    <div class="picture">
                        <picture>
                    
            <img src="data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width=%22250%22%20height=%22250%22%20viewBox%3D%220%200%20250%20250%22%3E%3C%2Fsvg%3E" data-src="https://img.jaeger-lecoultre.com/product-specifications-movement-1/771ff13ed9c04ba936b9603e6492d81a6f24b842.jpg" data-srcset="https://img.jaeger-lecoultre.com/product-specifications-movement-1/o-dpr-2/771ff13ed9c04ba936b9603e6492d81a6f24b842.jpg 2x, https://img.jaeger-lecoultre.com/product-specifications-movement-1/771ff13ed9c04ba936b9603e6492d81a6f24b842.jpg 1x" alt="Jaeger-LeCoultre Calibre 860" class="lazyload m-auto " data-uw-rm-alt-original="Jaeger-LeCoultre Calibre 860" data-uw-rm-alt="ALT">

            <noscript>
                <img src="https://img.jaeger-lecoultre.com/product-specifications-movement-1/771ff13ed9c04ba936b9603e6492d81a6f24b842.jpg"
                    alt="Jaeger-LeCoultre Calibre 860"
                    class="m-auto "
                >
            </noscript>
            </picture>
                    </div>
                </div>
            
            <h3 class="product-page-details__infos_title h5">Jaeger-LeCoultre Calibre 860</h3>
            <div class="product-page-details__infos-side-by-side">
                                    <div class="product-page-details__infos_start" data-tooltip-key="ProductPage.specification.standardizedEnergy.tooltip">
                        <h5 class="product-page-details__infos_subtitle" role="heading" aria-level="4" data-uw-rm-heading="level">MOVEMENT TYPE</h5>
                                            </div>

                    <div class="product-page-details__infos_text">
                                                    Manual winding                                             </div>
                                    <div class="product-page-details__infos_start" data-tooltip-key="ProductPage.specification.functions.tooltip">
                        <h5 class="product-page-details__infos_subtitle">Recto Functions</h5>
                                            </div>

                    <div class="product-page-details__infos_text">
                                                    Hour - Minute                                             </div>
                                    <div class="product-page-details__infos_start" data-tooltip-key="ProductPage.specification.functions.tooltip">
                        <h5 class="product-page-details__infos_subtitle">Verso Functions</h5>
                                            </div>

                    <div class="product-page-details__infos_text">
                                                    30-minute counter, Hour - Minute identical on front/back, Chronograph, Chronograph's Second                                             </div>
                                    <div class="product-page-details__infos_start" data-tooltip-key="ProductPage.specification.standardizedThickness.tooltip">
                        <h5 class="product-page-details__infos_subtitle">Thickness</h5>
                                            </div>

                    <div class="product-page-details__infos_text">
                                                    5.44mm                                             </div>
                                    <div class="product-page-details__infos_start" data-tooltip-key="ProductPage.specification.standardizedFrequenceVph.tooltip">
                        <h5 class="product-page-details__infos_subtitle">Vibrations per hour</h5>
                        <div id="tooltip-692811087aa87" class="tooltip tooltip--touch-enabled product-page-details__infos_subtitle__tooltip tooltip--minimal" data-options="{&quot;placement&quot;:&quot;top-start&quot;,&quot;enableArrow&quot;:false,&quot;offset&quot;:5,&quot;enableTouch&quot;:true}">
    <div class="tooltip__trigger" aria-describedby="tooltip-content-tooltip-692811087aa87" tabindex="0">
        <button type="button" class="btn btn--xs btn--default btn--icon-only btn--icon">
            <span class="sr-only">
                Discover more
            </span>

            <span class="btn__icon">
                <svg class="icon icon--info-12 icon--bidirectional icon--12" aria-hidden="true" focusable="false" role="img" data-uw-rm-br-ar-ref-lb="" data-uw-rm-sr="" data-uw-rm-br-ar-ref-ids-aria-labelledby="icon-692811087aabb0000">
                <use href="https://www.jaeger-lecoultre.com/jlc/dist/assets/icons.svg?cacheKey=b81f1f6a799799d00514031b7b625ae3#info-12"></use>
    </svg>
            </span>
        </button>
    </div>

    <div id="tooltip-content-tooltip-692811087aa87" class="tooltip__content" role="tooltip">
        The balance makes a to-and-fro movement at a given frequency (two vibrations). It is measured either in Vibration per Hour (VPH) or Hertz (Hz).
    </div>
</div>

                    </div>

                    <div class="product-page-details__infos_text">
                                                    28800                                             </div>
                                    <div class="product-page-details__infos_start" data-tooltip-key="ProductPage.specification.standardizedFrequenceHz.tooltip">
                        <h5 class="product-page-details__infos_subtitle">Frequency (HZ)</h5>
                        <div id="tooltip-692811087ab3d" class="tooltip tooltip--touch-enabled product-page-details__infos_subtitle__tooltip tooltip--minimal" data-options="{&quot;placement&quot;:&quot;top-start&quot;,&quot;enableArrow&quot;:false,&quot;offset&quot;:5,&quot;enableTouch&quot;:true}">
    <div class="tooltip__trigger" aria-describedby="tooltip-content-tooltip-692811087ab3d" tabindex="0">
        <button type="button" class="btn btn--xs btn--default btn--icon-only btn--icon">
            <span class="sr-only">
                Discover more
            </span>

            <span class="btn__icon">
                <svg class="icon icon--info-12 icon--bidirectional icon--12" aria-hidden="true" focusable="false" role="img" data-uw-rm-br-ar-ref-lb="" data-uw-rm-sr="" data-uw-rm-br-ar-ref-ids-aria-labelledby="icon-692811087ab5c0000">
                <use href="https://www.jaeger-lecoultre.com/jlc/dist/assets/icons.svg?cacheKey=b81f1f6a799799d00514031b7b625ae3#info-12"></use>
    </svg>
            </span>
        </button>
    </div>

    <div id="tooltip-content-tooltip-692811087ab3d" class="tooltip__content" role="tooltip">
        The balance makes a to-and-fro movement at a given frequency (two vibrations). It is measured either in Vibration per Hour (VPH) or Hertz (Hz).
    </div>
</div>

                    </div>

                    <div class="product-page-details__infos_text">
                                                    4                                             </div>
                                    <div class="product-page-details__infos_start" data-tooltip-key="ProductPage.specification.standardizedPowerReserve.tooltip">
                        <h5 class="product-page-details__infos_subtitle">Power reserve</h5>
                        <div id="tooltip-692811087abd4" class="tooltip tooltip--touch-enabled product-page-details__infos_subtitle__tooltip tooltip--minimal" data-options="{&quot;placement&quot;:&quot;top-start&quot;,&quot;enableArrow&quot;:false,&quot;offset&quot;:5,&quot;enableTouch&quot;:true}">
    <div class="tooltip__trigger" aria-describedby="tooltip-content-tooltip-692811087abd4" tabindex="0">
        <button type="button" class="btn btn--xs btn--default btn--icon-only btn--icon">
            <span class="sr-only">
                Discover more
            </span>

            <span class="btn__icon">
                <svg class="icon icon--info-12 icon--bidirectional icon--12" aria-hidden="true" focusable="false" role="img" data-uw-rm-br-ar-ref-lb="" data-uw-rm-sr="" data-uw-rm-br-ar-ref-ids-aria-labelledby="icon-692811087abf00000">
                <use href="https://www.jaeger-lecoultre.com/jlc/dist/assets/icons.svg?cacheKey=b81f1f6a799799d00514031b7b625ae3#info-12"></use>
    </svg>
            </span>
        </button>
    </div>

    <div id="tooltip-content-tooltip-692811087abd4" class="tooltip__content" role="tooltip">
        The time the watch will continue to function before rewinding is necessary.
    </div>
</div>

                    </div>

                    <div class="product-page-details__infos_text">
                                                    52 hours                                             </div>
                                    <div class="product-page-details__infos_start" data-tooltip-key="ProductPage.specification.standardizedNumberOfPieces.tooltip">
                        <h5 class="product-page-details__infos_subtitle">Components</h5>
                                            </div>

                    <div class="product-page-details__infos_text">
                                                    292                                             </div>
                                    <div class="product-page-details__infos_start" data-tooltip-key="ProductPage.specification.standardizedNumberOfRubis.tooltip">
                        <h5 class="product-page-details__infos_subtitle">Jewels</h5>
                        <div id="tooltip-692811087ac6f" class="tooltip tooltip--touch-enabled product-page-details__infos_subtitle__tooltip tooltip--minimal" data-options="{&quot;placement&quot;:&quot;top-start&quot;,&quot;enableArrow&quot;:false,&quot;offset&quot;:5,&quot;enableTouch&quot;:true}">
    <div class="tooltip__trigger" aria-describedby="tooltip-content-tooltip-692811087ac6f" tabindex="0">
        <button type="button" class="btn btn--xs btn--default btn--icon-only btn--icon">
            <span class="sr-only">
                Discover more
            </span>

            <span class="btn__icon">
                <svg class="icon icon--info-12 icon--bidirectional icon--12" aria-hidden="true" focusable="false" role="img" data-uw-rm-br-ar-ref-lb="" data-uw-rm-sr="" data-uw-rm-br-ar-ref-ids-aria-labelledby="icon-692811087ac880000">
                <use href="https://www.jaeger-lecoultre.com/jlc/dist/assets/icons.svg?cacheKey=b81f1f6a799799d00514031b7b625ae3#info-12"></use>
    </svg>
            </span>
        </button>
    </div>

    <div id="tooltip-content-tooltip-692811087ac6f" class="tooltip__content" role="tooltip">
        Jewels are used as bearings for pivots to reduce friction in a watch movement.
    </div>
</div>

                    </div>

                    <div class="product-page-details__infos_text">
                                                    38                                             </div>
                                    <div class="product-page-details__infos_start" data-tooltip-key="ProductPage.specification.standardizedNumberOfBarrels.tooltip">
                        <h5 class="product-page-details__infos_subtitle">Barrel</h5>
                                            </div>

                    <div class="product-page-details__infos_text">
                                                    1                                             </div>
                            </div>

                            <div class="btn-grid mb-sm">
                                            <a href="https://www.jaeger-lecoultre.com/au-en/services/customer-care-watches" class="btn btn--default btn--sm btn--full btn--icon btn--centered-with-icon" data-uw-rm-brl="PR" data-uw-original-href="https://www.jaeger-lecoultre.com/au-en/services/customer-care-watches">
                            <span class="btn__text" data-uw-trigger="" data-uw-ignore-s25="" aria-haspopup="dialog">Maintenance advice</span>
                            <span class="btn__icon pointer-events-none">
                                <svg class="icon icon--arrow-16 icon--bidirectional " aria-hidden="true" focusable="false" role="img" data-uw-rm-br-ar-ref-lb="" data-uw-rm-sr="" data-uw-rm-br-ar-ref-ids-aria-labelledby="icon-692811087acd40000">
                <use href="https://www.jaeger-lecoultre.com/jlc/dist/assets/icons.svg?cacheKey=b81f1f6a799799d00514031b7b625ae3#arrow-16"></use>
    </svg>
                            </span>
                        </a>
                    
                                            <button id="download-manual-button" class="btn btn--default btn--sm btn--full btn--icon btn--centered-with-icon">
                            <span class="btn__text" data-uw-trigger="" data-uw-ignore-s25="" aria-haspopup="dialog">Download the user manual</span>
                            <span class="btn__icon pointer-events-none">
                                <svg class="icon icon--download-16 " aria-hidden="true" focusable="false" role="img" data-uw-rm-br-ar-ref-lb="" data-uw-rm-sr="" data-uw-rm-br-ar-ref-ids-aria-labelledby="icon-692811087bbcf0000">
                <use href="https://www.jaeger-lecoultre.com/jlc/dist/assets/icons.svg?cacheKey=b81f1f6a799799d00514031b7b625ae3#download-16"></use>
    </svg>
                            </span>
                        </button>
                                    </div>

                
                    </div>
    </li>
    
    
            <li class="menu__item accordion__item">
    <button class="accordion__title menu__entry menu__link menu__toggle accordion__toggle " data-toggle="collapse" data-target="#product-accordion-tab-straps-and-buckles" aria-expanded="false" data-cy="straps-included-accordion-toggle">
        Straps &amp; Buckles
        <svg class="icon icon--chevron-down-10 icon--12" focusable="false" aria-labelledby="icon-69281108810840000" role="img">
                    <title id="icon-69281108810840000">Straps &amp; Buckles</title>
                <use href="https://www.jaeger-lecoultre.com/jlc/dist/assets/icons.svg?cacheKey=b81f1f6a799799d00514031b7b625ae3#chevron-down-10"></use>
    </svg>
    </button>

            <div id="product-accordion-tab-straps-and-buckles" class="accordion__content collapse">
            
                <div class="product-page-details__infos-strap-variants mb-base">
                                                                                            <div class="product-page-details__infos-strap-variant" data-cy="straps-included-media-item">
                                <div class="product-page-details__infos_start" data-tooltip-key="ProductPage.specification.strapsIncluded.tooltip">
                                    <h5 class="product-page-details__infos_subtitle">
                                        Mounted on the watch
                                    </h5>
                                                                    </div>

                                                                    <div class="product-card product-card--small-vertical" data-cy="product-card">
    <div class="product-card__picture">
        <div class="picture">
            <picture>
                                    <source srcset="data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width=%22768%22%20height=%22768%22%20viewBox%3D%220%200%20768%20768%22%3E%3C%2Fsvg%3E" data-srcset="https://img.jaeger-lecoultre.com/product-card-md-3/o-dpr-2/0f4169c7db632a8f0570a86a479a339e8cba5dc0.jpg 2x, https://img.jaeger-lecoultre.com/product-card-md-3/0f4169c7db632a8f0570a86a479a339e8cba5dc0.jpg 1x" media="(min-width: 768px)">
                            <source srcset="data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width=%22512%22%20height=%22512%22%20viewBox%3D%220%200%20512%20512%22%3E%3C%2Fsvg%3E" data-srcset="https://img.jaeger-lecoultre.com/product-card-sm-3/o-dpr-2/0f4169c7db632a8f0570a86a479a339e8cba5dc0.jpg 2x, https://img.jaeger-lecoultre.com/product-card-sm-3/0f4169c7db632a8f0570a86a479a339e8cba5dc0.jpg 1x" media="(min-width: 568px)">
            
            <img src="data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width=%22320%22%20height=%22320%22%20viewBox%3D%220%200%20320%20320%22%3E%3C%2Fsvg%3E" data-src="https://img.jaeger-lecoultre.com/product-card-3/0f4169c7db632a8f0570a86a479a339e8cba5dc0.jpg" data-srcset="https://img.jaeger-lecoultre.com/product-card-3/o-dpr-2/0f4169c7db632a8f0570a86a479a339e8cba5dc0.jpg 2x, https://img.jaeger-lecoultre.com/product-card-3/0f4169c7db632a8f0570a86a479a339e8cba5dc0.jpg 1x" alt="Grey" class="lazyload img-block  lazyload--fade " data-uw-rm-alt-original="Grey" data-uw-rm-alt="ALT">

            <noscript>
                <img src="https://img.jaeger-lecoultre.com/product-card-3/0f4169c7db632a8f0570a86a479a339e8cba5dc0.jpg"
                    alt="Grey"
                    class="img-block  lazyload--fade "
                >
            </noscript>
            </picture>
        </div>
    </div>

    <div class="product-card__body">
        <a href="https://www.jaeger-lecoultre.com/au-en/straps/fagliano-collection/fagliano-collection-grey-strap-qc35cf72" class="product-card__link expand-target" data-uw-rm-brl="PR" data-uw-original-href="https://www.jaeger-lecoultre.com/au-en/straps/fagliano-collection/fagliano-collection-grey-strap-qc35cf72">
            <div class="product-card__details">
                
                                    <h5 class="product-card__collection">Fagliano Collection</h5>
                
                <h5 class="product-card__name">Grey</h5>

                
                            </div>
        </a>
            </div>
</div>
                                                            </div>
                                                    <div class="product-page-details__infos-strap-variant" data-cy="straps-included-media-item">
                                <div class="product-page-details__infos_start" data-tooltip-key="ProductPage.specification.strapsIncluded.tooltip">
                                    <h5 class="product-page-details__infos_subtitle">
                                        Complimentary strap included
                                    </h5>
                                                                    </div>

                                                                    <div class="product-card product-card--small-vertical" data-cy="product-card">
    <div class="product-card__picture">
        <div class="picture">
            <picture>
                                    <source srcset="data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width=%22768%22%20height=%22768%22%20viewBox%3D%220%200%20768%20768%22%3E%3C%2Fsvg%3E" data-srcset="https://img.jaeger-lecoultre.com/product-card-md-3/o-dpr-2/c447d6b44ef53d8b4ef5136cabaf2cb97bb6ffa2.jpg 2x, https://img.jaeger-lecoultre.com/product-card-md-3/c447d6b44ef53d8b4ef5136cabaf2cb97bb6ffa2.jpg 1x" media="(min-width: 768px)">
                            <source srcset="data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width=%22512%22%20height=%22512%22%20viewBox%3D%220%200%20512%20512%22%3E%3C%2Fsvg%3E" data-srcset="https://img.jaeger-lecoultre.com/product-card-sm-3/o-dpr-2/c447d6b44ef53d8b4ef5136cabaf2cb97bb6ffa2.jpg 2x, https://img.jaeger-lecoultre.com/product-card-sm-3/c447d6b44ef53d8b4ef5136cabaf2cb97bb6ffa2.jpg 1x" media="(min-width: 568px)">
            
            <img src="data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width=%22320%22%20height=%22320%22%20viewBox%3D%220%200%20320%20320%22%3E%3C%2Fsvg%3E" data-src="https://img.jaeger-lecoultre.com/product-card-3/c447d6b44ef53d8b4ef5136cabaf2cb97bb6ffa2.jpg" data-srcset="https://img.jaeger-lecoultre.com/product-card-3/o-dpr-2/c447d6b44ef53d8b4ef5136cabaf2cb97bb6ffa2.jpg 2x, https://img.jaeger-lecoultre.com/product-card-3/c447d6b44ef53d8b4ef5136cabaf2cb97bb6ffa2.jpg 1x" alt="Black" class="lazyload img-block  lazyload--fade " data-uw-rm-alt-original="Black" data-uw-rm-alt="ALT">

            <noscript>
                <img src="https://img.jaeger-lecoultre.com/product-card-3/c447d6b44ef53d8b4ef5136cabaf2cb97bb6ffa2.jpg"
                    alt="Black"
                    class="img-block  lazyload--fade "
                >
            </noscript>
            </picture>
        </div>
    </div>

    <div class="product-card__body">
        <a href="https://www.jaeger-lecoultre.com/au-en/straps/fagliano-collection/fagliano-collection-black-strap-qc05c72c" class="product-card__link expand-target" data-uw-rm-brl="PR" data-uw-original-href="https://www.jaeger-lecoultre.com/au-en/straps/fagliano-collection/fagliano-collection-black-strap-qc05c72c">
            <div class="product-card__details">
                
                                    <h5 class="product-card__collection">Fagliano Collection</h5>
                
                <h5 class="product-card__name">Black</h5>

                
                            </div>
        </a>
            </div>
</div>
                                                            </div>
                                                            </div>

                            
                            <div class="product-page-details__infos_start" data-tooltip-key="ProductPage.specification.strap.tooltip">
                    <h3 class="product-page-details__infos_subtitle">Strap</h3>
                                    </div>

                <div class="product-page-details__infos_text">
                                            Interchangeable: Crafted with quick-release technology for seamless strap interchangeability <br>                                            Standard strand length at 12h: 75mm <br>                                            Length 6h: 120mm <br>                                            Lug width: 22mm                                     </div>
                            <div class="product-page-details__infos_start" data-tooltip-key="ProductPage.specification.buckle.tooltip">
                    <h3 class="product-page-details__infos_subtitle">Buckle</h3>
                                    </div>

                <div class="product-page-details__infos_text">
                                            Pin buckle <br>                                            Pink Gold 750/1000 (18 carats) <br>                                            Buckle width: 20mm                                     </div>

                
                    </div>
    </li>
    </ul>


                        
                                                    <h2 class="mt-md h5 mb-base">Color and material variants</h2>

    <div class="product-page-details__variants--slider">
        <div id="phx-product-variants" class="slider slider--linear slider--footer-inset slider--faded slider--initialized slider--horizontal slider--free-mode slider--watch-progress slider--backface-hidden slider-faded--end-visible" aria-roledescription="carousel" aria-label="Product variants">
            <div class="slider__body" aria-atomic="false" aria-live="polite" style="transform: translate3d(0px, 0px, 0px);">
                                    <div class="slider__item swiper-slide-visible swiper-slide-fully-visible slider__item--active" aria-roledescription="slide" aria-label="REVERSO TRIBUTE CHRONOGRAPH">
                        <a href="https://www.jaeger-lecoultre.com/au-en/watches/reverso/reverso-tribute/reverso-tribute-chronograph-q389848j" data-tracking="{&quot;event&quot;:&quot;item_variant&quot;,&quot;variant_id&quot;:&quot;Q389848J&quot;,&quot;items&quot;:[{&quot;item_id&quot;:&quot;Q389257J&quot;,&quot;item_name&quot;:&quot;Chronograph&quot;,&quot;item_brand&quot;:&quot;jlc&quot;,&quot;item_category&quot;:&quot;Watches&quot;,&quot;item_collection&quot;:&quot;Reverso Tribute&quot;,&quot;item_sellable&quot;:&quot;notsellable&quot;,&quot;currency&quot;:&quot;AUD&quot;,&quot;price&quot;:&quot;68000.00&quot;,&quot;item_variant&quot;:&quot;&quot;,&quot;item_line&quot;:&quot;&quot;}]}" class="picture picture--actionable picture--full btn btn--default product-page-details__variant" tabindex="0" data-uw-rm-brl="PR" data-uw-original-href="https://www.jaeger-lecoultre.com/au-en/watches/reverso/reverso-tribute/reverso-tribute-chronograph-q389848j">
                            <div class="picture">
                                <picture>
                                    <source srcset="https://img.jaeger-lecoultre.com/product-thumb-sm-5/o-dpr-2/6b62e8cd2ad2345e55a48d8e057fbed93939790f.jpg 2x, https://img.jaeger-lecoultre.com/product-thumb-sm-5/6b62e8cd2ad2345e55a48d8e057fbed93939790f.jpg 1x" data-srcset="https://img.jaeger-lecoultre.com/product-thumb-sm-5/o-dpr-2/6b62e8cd2ad2345e55a48d8e057fbed93939790f.jpg 2x, https://img.jaeger-lecoultre.com/product-thumb-sm-5/6b62e8cd2ad2345e55a48d8e057fbed93939790f.jpg 1x" media="(min-width: 568px)">
            
            <img src="https://img.jaeger-lecoultre.com/product-thumb-5/6b62e8cd2ad2345e55a48d8e057fbed93939790f.jpg" data-src="https://img.jaeger-lecoultre.com/product-thumb-5/6b62e8cd2ad2345e55a48d8e057fbed93939790f.jpg" data-srcset="https://img.jaeger-lecoultre.com/product-thumb-5/o-dpr-2/6b62e8cd2ad2345e55a48d8e057fbed93939790f.jpg 2x, https://img.jaeger-lecoultre.com/product-thumb-5/6b62e8cd2ad2345e55a48d8e057fbed93939790f.jpg 1x" alt="Chronograph" class=" ls-is-cached lazyloaded" srcset="https://img.jaeger-lecoultre.com/product-thumb-5/o-dpr-2/6b62e8cd2ad2345e55a48d8e057fbed93939790f.jpg 2x, https://img.jaeger-lecoultre.com/product-thumb-5/6b62e8cd2ad2345e55a48d8e057fbed93939790f.jpg 1x" data-uw-rm-alt-original="Chronograph" data-uw-rm-alt="ALT">

            <noscript>
                <img src="https://img.jaeger-lecoultre.com/product-thumb-5/6b62e8cd2ad2345e55a48d8e057fbed93939790f.jpg"
                    alt="Chronograph"
                    class=" "
                >
            </noscript>
            </picture>
                            </div>
                        </a>
                    </div>
                                    <div class="slider__item swiper-slide-visible swiper-slide-fully-visible slider__item--next" aria-roledescription="slide" aria-label="REVERSO TRIBUTE CHRONOGRAPH">
                        <a href="https://www.jaeger-lecoultre.com/au-en/watches/reverso/reverso-tribute/reverso-tribute-chronograph-q389256j" data-tracking="{&quot;event&quot;:&quot;item_variant&quot;,&quot;variant_id&quot;:&quot;Q389256J&quot;,&quot;items&quot;:[{&quot;item_id&quot;:&quot;Q389257J&quot;,&quot;item_name&quot;:&quot;Chronograph&quot;,&quot;item_brand&quot;:&quot;jlc&quot;,&quot;item_category&quot;:&quot;Watches&quot;,&quot;item_collection&quot;:&quot;Reverso Tribute&quot;,&quot;item_sellable&quot;:&quot;notsellable&quot;,&quot;currency&quot;:&quot;AUD&quot;,&quot;price&quot;:&quot;68000.00&quot;,&quot;item_variant&quot;:&quot;&quot;,&quot;item_line&quot;:&quot;&quot;}]}" class="picture picture--actionable picture--full btn btn--default product-page-details__variant" tabindex="0" data-uw-rm-brl="PR" data-uw-original-href="https://www.jaeger-lecoultre.com/au-en/watches/reverso/reverso-tribute/reverso-tribute-chronograph-q389256j">
                            <div class="picture">
                                <picture>
                                    <source srcset="https://img.jaeger-lecoultre.com/product-thumb-sm-5/o-dpr-2/28cb4b4ef4d7ca05755f6f8e0c8e5d8feb13bdfb.jpg 2x, https://img.jaeger-lecoultre.com/product-thumb-sm-5/28cb4b4ef4d7ca05755f6f8e0c8e5d8feb13bdfb.jpg 1x" data-srcset="https://img.jaeger-lecoultre.com/product-thumb-sm-5/o-dpr-2/28cb4b4ef4d7ca05755f6f8e0c8e5d8feb13bdfb.jpg 2x, https://img.jaeger-lecoultre.com/product-thumb-sm-5/28cb4b4ef4d7ca05755f6f8e0c8e5d8feb13bdfb.jpg 1x" media="(min-width: 568px)">
            
            <img src="https://img.jaeger-lecoultre.com/product-thumb-5/28cb4b4ef4d7ca05755f6f8e0c8e5d8feb13bdfb.jpg" data-src="https://img.jaeger-lecoultre.com/product-thumb-5/28cb4b4ef4d7ca05755f6f8e0c8e5d8feb13bdfb.jpg" data-srcset="https://img.jaeger-lecoultre.com/product-thumb-5/o-dpr-2/28cb4b4ef4d7ca05755f6f8e0c8e5d8feb13bdfb.jpg 2x, https://img.jaeger-lecoultre.com/product-thumb-5/28cb4b4ef4d7ca05755f6f8e0c8e5d8feb13bdfb.jpg 1x" alt="Chronograph" class=" ls-is-cached lazyloaded" srcset="https://img.jaeger-lecoultre.com/product-thumb-5/o-dpr-2/28cb4b4ef4d7ca05755f6f8e0c8e5d8feb13bdfb.jpg 2x, https://img.jaeger-lecoultre.com/product-thumb-5/28cb4b4ef4d7ca05755f6f8e0c8e5d8feb13bdfb.jpg 1x" data-uw-rm-alt-original="Chronograph" data-uw-rm-alt="ALT">

            <noscript>
                <img src="https://img.jaeger-lecoultre.com/product-thumb-5/28cb4b4ef4d7ca05755f6f8e0c8e5d8feb13bdfb.jpg"
                    alt="Chronograph"
                    class=" "
                >
            </noscript>
            </picture>
                            </div>
                        </a>
                    </div>
                            </div>
        </div>
    </div>

                         
                                                    <div class="mt-lg">
                                <div class="reassurance-banner reassurance-banner--column page_speed_1328286487">
                                      <button class="reassurance-banner__item" data-modal-open="modal-item-6928110764f5e0000" aria-label="FREE DELIVERY &amp; RETURNS" data-uw-rm-empty-ctrl="">
    <svg class="icon icon--delivery-24 icon--24" aria-hidden="true" focusable="false" role="img" data-uw-rm-br-ar-ref-lb="" data-uw-rm-sr="" data-uw-rm-br-ar-ref-ids-aria-labelledby="icon-692811088199a0000">
                <use href="https://www.jaeger-lecoultre.com/jlc/dist/assets/icons.svg?cacheKey=b81f1f6a799799d00514031b7b625ae3#delivery-24"></use>
    </svg>

    <div class="h5 reassurance-banner__title">FREE DELIVERY &amp; RETURNS</div>

            <svg class="icon icon--plus-alt-16 icon--16 reassurance-banner--column__icon-end" aria-hidden="true" focusable="false" role="img" data-uw-rm-br-ar-ref-lb="" data-uw-rm-sr="" data-uw-rm-br-ar-ref-ids-aria-labelledby="icon-69281108819af0000">
                <use href="https://www.jaeger-lecoultre.com/jlc/dist/assets/icons.svg?cacheKey=b81f1f6a799799d00514031b7b625ae3#plus-alt-16"></use>
    </svg>
    </button>
                                                                            <button class="reassurance-banner__item" data-modal-open="modal-item-69281107650b40000" aria-label="SECURE PAYMENT" data-uw-rm-empty-ctrl="">
    <svg class="icon icon--credit-card-24 icon--24" aria-hidden="true" focusable="false" role="img" data-uw-rm-br-ar-ref-lb="" data-uw-rm-sr="" data-uw-rm-br-ar-ref-ids-aria-labelledby="icon-69281108819d20000">
                <use href="https://www.jaeger-lecoultre.com/jlc/dist/assets/icons.svg?cacheKey=b81f1f6a799799d00514031b7b625ae3#credit-card-24"></use>
    </svg>

    <div class="h5 reassurance-banner__title">SECURE PAYMENT</div>

            <svg class="icon icon--plus-alt-16 icon--16 reassurance-banner--column__icon-end" aria-hidden="true" focusable="false" role="img" data-uw-rm-br-ar-ref-lb="" data-uw-rm-sr="" data-uw-rm-br-ar-ref-ids-aria-labelledby="icon-69281108819e00000">
                <use href="https://www.jaeger-lecoultre.com/jlc/dist/assets/icons.svg?cacheKey=b81f1f6a799799d00514031b7b625ae3#plus-alt-16"></use>
    </svg>
    </button>
                                                                            <button class="reassurance-banner__item" data-modal-open="modal-item-69281107651d10000" aria-label="SWISS MADE" data-uw-rm-empty-ctrl="">
    <svg class="icon icon--swiss-made-24 icon--24" aria-hidden="true" focusable="false" role="img" data-uw-rm-br-ar-ref-lb="" data-uw-rm-sr="" data-uw-rm-br-ar-ref-ids-aria-labelledby="icon-69281108819fc0000">
                <use href="https://www.jaeger-lecoultre.com/jlc/dist/assets/icons.svg?cacheKey=b81f1f6a799799d00514031b7b625ae3#swiss-made-24"></use>
    </svg>

    <div class="h5 reassurance-banner__title">SWISS MADE</div>

            <svg class="icon icon--plus-alt-16 icon--16 reassurance-banner--column__icon-end" aria-hidden="true" focusable="false" role="img" data-uw-rm-br-ar-ref-lb="" data-uw-rm-sr="" data-uw-rm-br-ar-ref-ids-aria-labelledby="icon-6928110881a0a0000">
                <use href="https://www.jaeger-lecoultre.com/jlc/dist/assets/icons.svg?cacheKey=b81f1f6a799799d00514031b7b625ae3#plus-alt-16"></use>
    </svg>
    </button>
                                                                            <button class="reassurance-banner__item" data-modal-open="modal-item-69281107652e40000" aria-label="UP TO 8 YEARS OF WARRANTY" data-uw-rm-empty-ctrl="">
    <svg class="icon icon--care-24 icon--24" aria-hidden="true" focusable="false" role="img" data-uw-rm-br-ar-ref-lb="" data-uw-rm-sr="" data-uw-rm-br-ar-ref-ids-aria-labelledby="icon-6928110881a250000">
                <use href="https://www.jaeger-lecoultre.com/jlc/dist/assets/icons.svg?cacheKey=b81f1f6a799799d00514031b7b625ae3#care-24"></use>
    </svg>

    <div class="h5 reassurance-banner__title">UP TO 8 YEARS OF WARRANTY</div>

            <svg class="icon icon--plus-alt-16 icon--16 reassurance-banner--column__icon-end" aria-hidden="true" focusable="false" role="img" data-uw-rm-br-ar-ref-lb="" data-uw-rm-sr="" data-uw-rm-br-ar-ref-ids-aria-labelledby="icon-6928110881a320000">
                <use href="https://www.jaeger-lecoultre.com/jlc/dist/assets/icons.svg?cacheKey=b81f1f6a799799d00514031b7b625ae3#plus-alt-16"></use>
    </svg>
    </button>
                                                                            <button class="reassurance-banner__item" data-modal-open="modal-item-69281107653fa0000" aria-label="AFTER-SALE SERVICES" data-uw-rm-empty-ctrl="">
    <svg class="icon icon--watch-maker-24 icon--24" aria-hidden="true" focusable="false" role="img" data-uw-rm-br-ar-ref-lb="" data-uw-rm-sr="" data-uw-rm-br-ar-ref-ids-aria-labelledby="icon-6928110881a4e0000">
                <use href="https://www.jaeger-lecoultre.com/jlc/dist/assets/icons.svg?cacheKey=b81f1f6a799799d00514031b7b625ae3#watch-maker-24"></use>
    </svg>

    <div class="h5 reassurance-banner__title">AFTER-SALE SERVICES</div>

            <svg class="icon icon--plus-alt-16 icon--16 reassurance-banner--column__icon-end" aria-hidden="true" focusable="false" role="img" data-uw-rm-br-ar-ref-lb="" data-uw-rm-sr="" data-uw-rm-br-ar-ref-ids-aria-labelledby="icon-6928110881a5a0000">
                <use href="https://www.jaeger-lecoultre.com/jlc/dist/assets/icons.svg?cacheKey=b81f1f6a799799d00514031b7b625ae3#plus-alt-16"></use>
    </svg>
    </button>
                                                                    </div>
                            </div>
                        
                        
                        
                        
                                                    <h5 class="mt-md mb-sm" role="heading" aria-level="3" data-uw-rm-heading="level">Personalise your watch</h5>
                            <div class="duo-button duo-button--stacked duo-button--full">
                                <div class="duo-button__wrapper">
                                                                            <a href="https://www.jaeger-lecoultre.com/au-en/strap-search?reference=Q389257J" class="btn btn--default btn--xs btn--even btn--outlined btn--full btn--icon btn--description-icons-start-end" data-uw-rm-brl="PR" data-uw-original-href="https://www.jaeger-lecoultre.com/au-en/strap-search?reference=Q389257J" aria-label="search" data-uw-rm-empty-ctrl="">
                                        <span class="btn__icon btn__icon--start">
                                            <svg class="icon icon--strap-watch-36 icon--36" aria-hidden="true" focusable="false" role="img" data-uw-rm-br-ar-ref-lb="" data-uw-rm-sr="" data-uw-rm-br-ar-ref-ids-aria-labelledby="icon-6928110881a800000">
                <use href="https://www.jaeger-lecoultre.com/jlc/dist/assets/icons.svg?cacheKey=b81f1f6a799799d00514031b7b625ae3#strap-watch-36"></use>
    </svg>
                                        </span>

                                            <span class="btn__text" data-description="Add another compatible strap" data-uw-trigger="" data-uw-ignore-s25="" aria-haspopup="dialog">
                                            Strap finder
                                        </span>

                                            <span class="btn__icon btn__icon--end">
                                            <svg class="icon icon--arrow-16 icon--bidirectional " aria-hidden="true" focusable="false" role="img" data-uw-rm-br-ar-ref-lb="" data-uw-rm-sr="" data-uw-rm-br-ar-ref-ids-aria-labelledby="icon-6928110881a8e0000">
                <use href="https://www.jaeger-lecoultre.com/jlc/dist/assets/icons.svg?cacheKey=b81f1f6a799799d00514031b7b625ae3#arrow-16"></use>
    </svg>
                                        </span>
                                        </a>
                                                                    </div>
                            </div>
                                            </div>


Master Ultra Thin
<a href="https://www.jaeger-lecoultre.com/au-en/watches/master-ultra-thin/master-ultra-thin-date-stainless-steel-q1238460" class="product-card__link" data-tracking="{&quot;event&quot;:&quot;select_item&quot;,&quot;ecommerce&quot;:{&quot;currency&quot;:&quot;AUD&quot;,&quot;items&quot;:[{&quot;item_id&quot;:&quot;Q1238460&quot;,&quot;item_name&quot;:&quot;Date&quot;,&quot;item_brand&quot;:&quot;jlc&quot;,&quot;item_category&quot;:&quot;Watches&quot;,&quot;item_collection&quot;:&quot;Master Ultra Thin&quot;,&quot;item_sellable&quot;:&quot;sellable&quot;,&quot;currency&quot;:&quot;AUD&quot;,&quot;price&quot;:&quot;16300.00&quot;,&quot;item_variant&quot;:&quot;&quot;,&quot;item_line&quot;:&quot;&quot;}],&quot;_currency&quot;:{&quot;AU&quot;:&quot;AUD&quot;}}}" data-uw-rm-brl="PR" data-uw-original-href="https://www.jaeger-lecoultre.com/au-en/watches/master-ultra-thin/master-ultra-thin-date-stainless-steel-q1238460"><div class="simple-slider product-card__slider" style="pointer-events: auto;"><div class="simple-slider__body"><div class="simple-slider__slide product-card__picture"><div class="picture"><picture><source media="(min-width: 768px)" srcset="https://img.jaeger-lecoultre.com/product-card-md-3/o-dpr-2/52a4338d19ca44e845104234d6478b312f25ffdf.jpg 2x, https://img.jaeger-lecoultre.com/product-card-md-3/52a4338d19ca44e845104234d6478b312f25ffdf.jpg 1x" data-srcset="https://img.jaeger-lecoultre.com/product-card-md-3/o-dpr-2/52a4338d19ca44e845104234d6478b312f25ffdf.jpg 2x, https://img.jaeger-lecoultre.com/product-card-md-3/52a4338d19ca44e845104234d6478b312f25ffdf.jpg 1x"><source media="(min-width: 568px)" srcset="https://img.jaeger-lecoultre.com/product-card-sm-3/o-dpr-2/52a4338d19ca44e845104234d6478b312f25ffdf.jpg 2x, https://img.jaeger-lecoultre.com/product-card-sm-3/52a4338d19ca44e845104234d6478b312f25ffdf.jpg 1x" data-srcset="https://img.jaeger-lecoultre.com/product-card-sm-3/o-dpr-2/52a4338d19ca44e845104234d6478b312f25ffdf.jpg 2x, https://img.jaeger-lecoultre.com/product-card-sm-3/52a4338d19ca44e845104234d6478b312f25ffdf.jpg 1x"><img src="https://img.jaeger-lecoultre.com/product-card-3/52a4338d19ca44e845104234d6478b312f25ffdf.jpg" data-src="https://img.jaeger-lecoultre.com/product-card-3/52a4338d19ca44e845104234d6478b312f25ffdf.jpg" data-srcset="https://img.jaeger-lecoultre.com/product-card-3/o-dpr-2/52a4338d19ca44e845104234d6478b312f25ffdf.jpg 2x, https://img.jaeger-lecoultre.com/product-card-3/52a4338d19ca44e845104234d6478b312f25ffdf.jpg 1x" class=" lazyloaded" alt="Date" srcset="https://img.jaeger-lecoultre.com/product-card-3/o-dpr-2/52a4338d19ca44e845104234d6478b312f25ffdf.jpg 2x, https://img.jaeger-lecoultre.com/product-card-3/52a4338d19ca44e845104234d6478b312f25ffdf.jpg 1x" data-uw-rm-alt-original="Date" data-uw-rm-alt="ALT"></picture></div></div><div class="simple-slider__slide product-card__picture"><div class="picture"><picture><source media="(min-width: 768px)" srcset="https://img.jaeger-lecoultre.com/product-card-md-3/o-dpr-2/fd19fbf097eed0e17837f9ef540dd75b3edfac18.jpg 2x, https://img.jaeger-lecoultre.com/product-card-md-3/fd19fbf097eed0e17837f9ef540dd75b3edfac18.jpg 1x" data-srcset="https://img.jaeger-lecoultre.com/product-card-md-3/o-dpr-2/fd19fbf097eed0e17837f9ef540dd75b3edfac18.jpg 2x, https://img.jaeger-lecoultre.com/product-card-md-3/fd19fbf097eed0e17837f9ef540dd75b3edfac18.jpg 1x"><source media="(min-width: 568px)" srcset="https://img.jaeger-lecoultre.com/product-card-sm-3/o-dpr-2/fd19fbf097eed0e17837f9ef540dd75b3edfac18.jpg 2x, https://img.jaeger-lecoultre.com/product-card-sm-3/fd19fbf097eed0e17837f9ef540dd75b3edfac18.jpg 1x" data-srcset="https://img.jaeger-lecoultre.com/product-card-sm-3/o-dpr-2/fd19fbf097eed0e17837f9ef540dd75b3edfac18.jpg 2x, https://img.jaeger-lecoultre.com/product-card-sm-3/fd19fbf097eed0e17837f9ef540dd75b3edfac18.jpg 1x"><img src="https://img.jaeger-lecoultre.com/product-card-3/fd19fbf097eed0e17837f9ef540dd75b3edfac18.jpg" data-src="https://img.jaeger-lecoultre.com/product-card-3/fd19fbf097eed0e17837f9ef540dd75b3edfac18.jpg" data-srcset="https://img.jaeger-lecoultre.com/product-card-3/o-dpr-2/fd19fbf097eed0e17837f9ef540dd75b3edfac18.jpg 2x, https://img.jaeger-lecoultre.com/product-card-3/fd19fbf097eed0e17837f9ef540dd75b3edfac18.jpg 1x" class=" lazyloaded" alt="Date" srcset="https://img.jaeger-lecoultre.com/product-card-3/o-dpr-2/fd19fbf097eed0e17837f9ef540dd75b3edfac18.jpg 2x, https://img.jaeger-lecoultre.com/product-card-3/fd19fbf097eed0e17837f9ef540dd75b3edfac18.jpg 1x" data-uw-rm-alt-original="Date" data-uw-rm-alt="ALT"></picture></div></div><div class="simple-slider__slide product-card__picture"><div class="picture"><picture><source media="(min-width: 768px)" srcset="https://img.jaeger-lecoultre.com/product-card-md-3/o-dpr-2/508cef4dfd1f2f7e144319638ea13a054136be8f.jpg 2x, https://img.jaeger-lecoultre.com/product-card-md-3/508cef4dfd1f2f7e144319638ea13a054136be8f.jpg 1x" data-srcset="https://img.jaeger-lecoultre.com/product-card-md-3/o-dpr-2/508cef4dfd1f2f7e144319638ea13a054136be8f.jpg 2x, https://img.jaeger-lecoultre.com/product-card-md-3/508cef4dfd1f2f7e144319638ea13a054136be8f.jpg 1x"><source media="(min-width: 568px)" srcset="https://img.jaeger-lecoultre.com/product-card-sm-3/o-dpr-2/508cef4dfd1f2f7e144319638ea13a054136be8f.jpg 2x, https://img.jaeger-lecoultre.com/product-card-sm-3/508cef4dfd1f2f7e144319638ea13a054136be8f.jpg 1x" data-srcset="https://img.jaeger-lecoultre.com/product-card-sm-3/o-dpr-2/508cef4dfd1f2f7e144319638ea13a054136be8f.jpg 2x, https://img.jaeger-lecoultre.com/product-card-sm-3/508cef4dfd1f2f7e144319638ea13a054136be8f.jpg 1x"><img src="https://img.jaeger-lecoultre.com/product-card-3/508cef4dfd1f2f7e144319638ea13a054136be8f.jpg" data-src="https://img.jaeger-lecoultre.com/product-card-3/508cef4dfd1f2f7e144319638ea13a054136be8f.jpg" data-srcset="https://img.jaeger-lecoultre.com/product-card-3/o-dpr-2/508cef4dfd1f2f7e144319638ea13a054136be8f.jpg 2x, https://img.jaeger-lecoultre.com/product-card-3/508cef4dfd1f2f7e144319638ea13a054136be8f.jpg 1x" class=" lazyloaded" alt="Date" srcset="https://img.jaeger-lecoultre.com/product-card-3/o-dpr-2/508cef4dfd1f2f7e144319638ea13a054136be8f.jpg 2x, https://img.jaeger-lecoultre.com/product-card-3/508cef4dfd1f2f7e144319638ea13a054136be8f.jpg 1x" data-uw-rm-alt-original="Date" data-uw-rm-alt="ALT"></picture></div></div></div><div class="product-card__slider-pagination"><span class="simple-slider__pagination-bullet simple-slider__pagination-bullet--active"></span><span class="simple-slider__pagination-bullet"></span><span class="simple-slider__pagination-bullet"></span></div></div><div class="product-card__body"><div class="product-card__details"><div class="product-card__tags" data-cy="product-tags"><span class="tag product-card__tag">New</span></div><h5 class="product-card__collection">Master Ultra Thin</h5><h5 class="product-card__name">Date</h5><div class="product-card__specs">39 mm Stainless steel Automatic Date Watch</div><div class="product-price product-card__price product-price--thin product-price--small"><span><span data-price="currency" class="" data-cy="price-currency">AU$</span> <span data-price="value">16,300</span></span></div></div></div></a>

Details, price, specs
<div class="product-images-grid__item-container">
                    <button class="picture picture--actionable picture--contain lightbox-trigger" data-lightbox-open="product-light-box-69283c7adc817" data-lightbox-index="0">
                <picture>
                                    <source srcset="https://img.jaeger-lecoultre.com/product-grid-hero-xl-4/o-dpr-2/52a4338d19ca44e845104234d6478b312f25ffdf.jpg 2x, https://img.jaeger-lecoultre.com/product-grid-hero-xl-4/52a4338d19ca44e845104234d6478b312f25ffdf.jpg 1x" media="(min-width: 1280px)">
                            <source srcset="https://img.jaeger-lecoultre.com/product-grid-hero-lg-4/o-dpr-2/52a4338d19ca44e845104234d6478b312f25ffdf.jpg 2x, https://img.jaeger-lecoultre.com/product-grid-hero-lg-4/52a4338d19ca44e845104234d6478b312f25ffdf.jpg 1x" media="(min-width: 1024px)">
            
            <img src="https://img.jaeger-lecoultre.com/product-grid-hero-4/52a4338d19ca44e845104234d6478b312f25ffdf.jpg" alt="Front product image of the watch Q1238460" srcset="https://img.jaeger-lecoultre.com/product-grid-hero-4/o-dpr-2/52a4338d19ca44e845104234d6478b312f25ffdf.jpg 2x, https://img.jaeger-lecoultre.com/product-grid-hero-4/52a4338d19ca44e845104234d6478b312f25ffdf.jpg 1x" class="img-block " data-uw-rm-alt-original="Front product image of the watch Q1238460" data-uw-rm-alt="ALT">
            </picture>
            </button>
        
        <ul class="product-images-grid__item-actions" role="presentation">
        
                    <li role="presentation">
                <div class="phoenix-wishlist-button" data-v-app=""><button class="btn btn--default btn--sm btn--icon-only btn--icon btn-wishlist btn--white" aria-label="Add to wishlist" data-cy="wishlist-button" data-tracking="{&quot;event&quot;:&quot;add_to_wishlist&quot;,&quot;page_type&quot;:&quot;Product&quot;,&quot;wishlist_name&quot;:&quot;wishlist&quot;,&quot;items&quot;:[null]}" collection="Master Ultra Thin" data-algolia-insights="{&quot;objectIDs&quot;:[&quot;Page::5060&quot;],&quot;index&quot;:&quot;products&quot;,&quot;eventName&quot;:&quot;Product converted&quot;,&quot;type&quot;:&quot;conversion&quot;}"><span class="btn__icon"><svg class="icon icon--heart-20 icon--20" aria-hidden="true" focusable="false" role="img"><!----><use xlink:href="https://www.jaeger-lecoultre.com/jlc/dist/assets/icons.svg?cacheKey=b81f1f6a799799d00514031b7b625ae3#heart-20"></use></svg></span></button></div>

            </li>
            </ul>
    </div>

<div class="product-page-details__infos" data-cy="product-page-details-top">
                        <div class="hidden md:block">
                            <div class="product-page-details__tags" data-cy="product-tags">
                    <span class="tag product-page-details__tag">New</span>
            </div>

<div class="product-page-details__title-price-wrapper">
    <h1 class="product-page-details__title h3" role="heading" aria-level="2" data-uw-rm-heading="level">
        Master Ultra Thin<br>
        <span class="product-page-details__subtitle">Date</span>
    </h1>

            <div class="product-price country-reveal-container">
            <span class="price-from--prices "><span data-country-code="AU" class=""><span class="product-price__value">
                    <span data-price="currency" class="">AU$</span>
            <span data-price="value">16,300</span>
            </span>

            <span class="product-price__vat hidden">Price including taxes</span>
    </span></span>
        </div>
    </div>


    <div class="product-page-details__resume text--muted">
        <span class="block">39 mm Stainless steel Automatic Date Watch</span>

            </div>
                        </div>

                        <div class="btn-grid--xs mb-sm country-reveal-container" data-cy="product-cta-container">
                                                            
                                                                    <a href="tel:+61 2 8663 8028" type="button" class="btn btn--default btn--icon btn--full btn--negative" data-cy="shop-by-phone-btn" data-country-code="AU" data-tracking="{&quot;event&quot;:&quot;call_center&quot;,&quot;button_position&quot;:&quot;product_page&quot;,&quot;button_type&quot;:&quot;buy&quot;,&quot;items&quot;:[{&quot;item_id&quot;:&quot;Q1238460&quot;,&quot;item_name&quot;:&quot;Date&quot;,&quot;item_brand&quot;:&quot;jlc&quot;,&quot;item_category&quot;:&quot;Watches&quot;,&quot;item_collection&quot;:&quot;Master Ultra Thin&quot;,&quot;item_sellable&quot;:&quot;sellable&quot;,&quot;currency&quot;:&quot;AUD&quot;,&quot;price&quot;:&quot;16300.00&quot;,&quot;item_variant&quot;:&quot;&quot;,&quot;item_line&quot;:&quot;&quot;}]}" data-algolia-insights="{&quot;objectIDs&quot;:[&quot;Page::5060&quot;],&quot;index&quot;:&quot;products&quot;,&quot;eventName&quot;:&quot;Product converted&quot;,&quot;type&quot;:&quot;conversion&quot;}" aria-label="call +61 2 8663 8028" data-uw-rm-vglnk="" uw-rm-vague-link-id="tel:+61 2 8663 8028$call +61 2 8663 8028">
        <span class="btn__text" data-uw-trigger="" data-uw-ignore-s25="" aria-haspopup="dialog">Inquire by phone</span>

                    <span class="btn__icon pointer-events-none">
                <svg class="icon icon--phone-16 " aria-hidden="true" focusable="false" role="img" data-uw-rm-br-ar-ref-lb="" data-uw-rm-sr="" data-uw-rm-br-ar-ref-ids-aria-labelledby="icon-69283c7b4d52a0000">
                <use href="https://www.jaeger-lecoultre.com/jlc/dist/assets/icons.svg?cacheKey=b81f1f6a799799d00514031b7b625ae3#phone-16"></use>
    </svg>
            </span>
            </a>
                                
                                                                    <button id="boutique-stock-availability-modal-button" type="button" class="btn btn--default btn--full btn--icon" data-tracking="{&quot;event&quot;:&quot;try_in_boutique&quot;,&quot;items&quot;:[{&quot;item_id&quot;:&quot;Q1238460&quot;,&quot;item_name&quot;:&quot;Date&quot;,&quot;item_brand&quot;:&quot;jlc&quot;,&quot;item_category&quot;:&quot;Watches&quot;,&quot;item_collection&quot;:&quot;Master Ultra Thin&quot;,&quot;item_sellable&quot;:&quot;sellable&quot;,&quot;currency&quot;:&quot;AUD&quot;,&quot;price&quot;:&quot;16300.00&quot;,&quot;item_variant&quot;:&quot;&quot;,&quot;item_line&quot;:&quot;&quot;}]}" data-modal-open="boutique-stock-availability-modal" data-cy="btn-find-in-boutique" data-algolia-insights="{&quot;objectIDs&quot;:[&quot;Page::5060&quot;],&quot;index&quot;:&quot;products&quot;,&quot;eventName&quot;:&quot;Product converted&quot;,&quot;type&quot;:&quot;conversion&quot;}" aria-label="Availability in boutique" data-uw-rm-empty-ctrl="">
    <span class="btn__text" data-uw-trigger="" data-uw-ignore-s25="" aria-haspopup="dialog">Availability in boutique</span>
    <span class="btn__icon pointer-events-none">
        <svg class="icon icon--pin-16 " aria-hidden="true" focusable="false" role="img" data-uw-rm-br-ar-ref-lb="" data-uw-rm-sr="" data-uw-rm-br-ar-ref-ids-aria-labelledby="icon-69283c7b4d5aa0000">
                <use href="https://www.jaeger-lecoultre.com/jlc/dist/assets/icons.svg?cacheKey=b81f1f6a799799d00514031b7b625ae3#pin-16"></use>
    </svg>
    </span>
</button>
                                
                                <a href="https://www.jaeger-lecoultre.com/au-en/boutique-appointment?reference=Q1238460" type="button" class="btn btn--default btn--full btn--icon" data-tracking="{&quot;event&quot;:&quot;baa_selected&quot;,&quot;boutique_id&quot;:null}" data-algolia-insights="{&quot;objectIDs&quot;:[&quot;Page::5060&quot;],&quot;index&quot;:&quot;products&quot;,&quot;eventName&quot;:&quot;Product converted&quot;,&quot;type&quot;:&quot;conversion&quot;}" data-uw-rm-brl="PR" data-uw-original-href="https://www.jaeger-lecoultre.com/au-en/boutique-appointment?reference=Q1238460" aria-label="Book an appointment" data-uw-rm-empty-ctrl="">
    <span class="btn__text" data-uw-trigger="" data-uw-ignore-s25="" aria-haspopup="dialog">Book an appointment</span>
    <span class="btn__icon pointer-events-none">
        <svg class="icon icon--clock-16 " aria-hidden="true" focusable="false" role="img" data-uw-rm-br-ar-ref-lb="" data-uw-rm-sr="" data-uw-rm-br-ar-ref-ids-aria-labelledby="icon-69283c7b4d6240000">
                <use href="https://www.jaeger-lecoultre.com/jlc/dist/assets/icons.svg?cacheKey=b81f1f6a799799d00514031b7b625ae3#clock-16"></use>
    </svg>
    </span>
</a>

                                <a href="https://wa.me/+61483905200" target="_blank" type="button" data-tracking="{&quot;event&quot;:&quot;whatsapp&quot;,&quot;items&quot;:[{&quot;item_id&quot;:&quot;Q1238460&quot;,&quot;item_name&quot;:&quot;Date&quot;,&quot;item_brand&quot;:&quot;jlc&quot;,&quot;item_category&quot;:&quot;Watches&quot;,&quot;item_collection&quot;:&quot;Master Ultra Thin&quot;,&quot;item_sellable&quot;:&quot;sellable&quot;,&quot;currency&quot;:&quot;AUD&quot;,&quot;price&quot;:&quot;16300.00&quot;,&quot;item_variant&quot;:&quot;&quot;,&quot;item_line&quot;:&quot;&quot;}]}" class="btn btn--default btn--full" data-algolia-insights="{&quot;objectIDs&quot;:[&quot;Page::5060&quot;],&quot;index&quot;:&quot;products&quot;,&quot;eventName&quot;:&quot;Product converted&quot;,&quot;type&quot;:&quot;conversion&quot;}" data-uw-rm-brl="PR" data-uw-original-href="https://wa.me/+61483905200" aria-label="WhatsApp - open in a new tab" data-uw-rm-empty-ctrl="" data-uw-rm-ext-link="" uw-rm-external-link-id="https://wa.me/+61483905200$whatsapp">
        <span class="btn__text" data-uw-trigger="" data-uw-ignore-s25="" aria-haspopup="dialog">WhatsApp</span>
        <span class="btn__icon pointer-events-none">
            <svg class="icon icon--whatsapp-16 " aria-hidden="true" focusable="false" role="img" data-uw-rm-br-ar-ref-lb="" data-uw-rm-sr="" data-uw-rm-br-ar-ref-ids-aria-labelledby="icon-69283c7b4d9310000">
                <use href="https://www.jaeger-lecoultre.com/jlc/dist/assets/icons.svg?cacheKey=b81f1f6a799799d00514031b7b625ae3#whatsapp-16"></use>
    </svg>
        </span>
    </a>

                                
                                                                    <span id="show-sticky-add-to-bag"></span>
                                                                                    </div>

                        
                        
                        <ul class="accordion menu menu--border-full-width product-page-details__description-accordion">
    
    <li class="menu__item accordion__item">
    <button class="accordion__title menu__entry menu__link menu__toggle accordion__toggle " data-toggle="collapse" data-target="#product-accordion-tab-description" aria-expanded="false">
        Description
        <svg class="icon icon--chevron-down-10 icon--12" focusable="false" aria-labelledby="icon-69283c7b4e2540000" role="img">
                    <title id="icon-69283c7b4e2540000">Description</title>
                <use href="https://www.jaeger-lecoultre.com/jlc/dist/assets/icons.svg?cacheKey=b81f1f6a799799d00514031b7b625ae3#chevron-down-10"></use>
    </svg>
    </button>

            <div id="product-accordion-tab-description" class="accordion__content collapse">
            
                <div class="product-page-details__infos_text">
            The Master Ultra Thin Date embodies refined elegance in a 39mm steel case, a mere 7.8mm in profile. Its copper-toned, grained dial presents a study in balanced symmetry, with a date display subtly positioned at 6 o'clock. Elongated, trapezoidal indices complement the iconic Dauphine hands, their alternating brushed and polished facets creating a captivating dance of light. A brown alligator strap, secured with a stainless steel folding buckle, offers effortless interchangeability. The reverse reveals the meticulously finished in-house calibre 899, designed and assembled under the same roof at the Grande Maison, showcasing beveling, Côtes de Genève, and blued screws.
        </div>

                
                    </div>
    </li>

    
    <li class="menu__item accordion__item">
    <button class="accordion__title menu__entry menu__link menu__toggle accordion__toggle " data-toggle="collapse" data-target="#product-accordion-tab-feature" aria-expanded="false">
        Features
        <svg class="icon icon--chevron-down-10 icon--12" focusable="false" aria-labelledby="icon-69283c7b4e5af0000" role="img">
                    <title id="icon-69283c7b4e5af0000">Features</title>
                <use href="https://www.jaeger-lecoultre.com/jlc/dist/assets/icons.svg?cacheKey=b81f1f6a799799d00514031b7b625ae3#chevron-down-10"></use>
    </svg>
    </button>

            <div id="product-accordion-tab-feature" class="accordion__content collapse">
            
                <div class="product-page-details__infos_start" data-tooltip-key="ProductPage.specification.case.tooltip">
                <h3 class="product-page-details__infos_subtitle">Case</h3>
                            </div>

            <div class="product-page-details__infos_text">
                                    Stainless steel <br>                                    Diameter: 39 mm <br>                                    Thickness: 7.89mm                             </div>
                    <div class="product-page-details__infos_start" data-tooltip-key="ProductPage.specification.waterResistance.tooltip">
                <h3 class="product-page-details__infos_subtitle">Water resistance</h3>
                            </div>

            <div class="product-page-details__infos_text">
                                    5 bar                             </div>
                    <div class="product-page-details__infos_start" data-tooltip-key="ProductPage.specification.dial.tooltip">
                <h3 class="product-page-details__infos_subtitle">Dial</h3>
                            </div>

            <div class="product-page-details__infos_text">
                                    Appliqued hour-markers, Copper, Grained                             </div>
                    <div class="product-page-details__infos_start" data-tooltip-key="ProductPage.specification.hands.tooltip">
                <h3 class="product-page-details__infos_subtitle">Hands</h3>
                            </div>

            <div class="product-page-details__infos_text">
                                    Dauphines                             </div>

                
                    </div>
    </li>


            
        <li class="menu__item accordion__item">
    <button class="accordion__title menu__entry menu__link menu__toggle accordion__toggle " data-toggle="collapse" data-target="#product-accordion-tab-movement" aria-expanded="false">
        Movement
        <svg class="icon icon--chevron-down-10 icon--12" focusable="false" aria-labelledby="icon-69283c7b4fd130000" role="img">
                    <title id="icon-69283c7b4fd130000">Movement</title>
                <use href="https://www.jaeger-lecoultre.com/jlc/dist/assets/icons.svg?cacheKey=b81f1f6a799799d00514031b7b625ae3#chevron-down-10"></use>
    </svg>
    </button>

            <div id="product-accordion-tab-movement" class="accordion__content collapse">
            
                <div class="mb-sm text-center bg-media">
                    <div class="picture">
                        <picture>
                    
            <img src="data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width=%22250%22%20height=%22250%22%20viewBox%3D%220%200%20250%20250%22%3E%3C%2Fsvg%3E" data-src="https://img.jaeger-lecoultre.com/product-specifications-movement-1/54f69a94f991170d75ec75c1c8de1639bc596bc1.jpg" data-srcset="https://img.jaeger-lecoultre.com/product-specifications-movement-1/o-dpr-2/54f69a94f991170d75ec75c1c8de1639bc596bc1.jpg 2x, https://img.jaeger-lecoultre.com/product-specifications-movement-1/54f69a94f991170d75ec75c1c8de1639bc596bc1.jpg 1x" alt="Jaeger-LeCoultre Calibre 899" class="lazyload m-auto " data-uw-rm-alt-original="Jaeger-LeCoultre Calibre 899" data-uw-rm-alt="ALT">

            <noscript>
                <img src="https://img.jaeger-lecoultre.com/product-specifications-movement-1/54f69a94f991170d75ec75c1c8de1639bc596bc1.jpg"
                    alt="Jaeger-LeCoultre Calibre 899"
                    class="m-auto "
                >
            </noscript>
            </picture>
                    </div>
                </div>
            
            <h3 class="product-page-details__infos_title h5">Jaeger-LeCoultre Calibre 899</h3>
            <div class="product-page-details__infos-side-by-side">
                                    <div class="product-page-details__infos_start" data-tooltip-key="ProductPage.specification.standardizedEnergy.tooltip">
                        <h5 class="product-page-details__infos_subtitle" role="heading" aria-level="4" data-uw-rm-heading="level">MOVEMENT TYPE</h5>
                                            </div>

                    <div class="product-page-details__infos_text">
                                                    Automatic winding                                             </div>
                                    <div class="product-page-details__infos_start" data-tooltip-key="ProductPage.specification.functions.tooltip">
                        <h5 class="product-page-details__infos_subtitle">Functions</h5>
                                            </div>

                    <div class="product-page-details__infos_text">
                                                    Seconds, Hour - Minute, Date                                             </div>
                                    <div class="product-page-details__infos_start" data-tooltip-key="ProductPage.specification.standardizedThickness.tooltip">
                        <h5 class="product-page-details__infos_subtitle">Thickness</h5>
                                            </div>

                    <div class="product-page-details__infos_text">
                                                    3.3mm                                             </div>
                                    <div class="product-page-details__infos_start" data-tooltip-key="ProductPage.specification.standardizedFrequenceVph.tooltip">
                        <h5 class="product-page-details__infos_subtitle">Vibrations per hour</h5>
                        <div id="tooltip-69283c7b4f493" class="tooltip tooltip--touch-enabled product-page-details__infos_subtitle__tooltip tooltip--minimal" data-options="{&quot;placement&quot;:&quot;top-start&quot;,&quot;enableArrow&quot;:false,&quot;offset&quot;:5,&quot;enableTouch&quot;:true}">
    <div class="tooltip__trigger" aria-describedby="tooltip-content-tooltip-69283c7b4f493" tabindex="0">
        <button type="button" class="btn btn--xs btn--default btn--icon-only btn--icon">
            <span class="sr-only">
                Discover more
            </span>

            <span class="btn__icon">
                <svg class="icon icon--info-12 icon--bidirectional icon--12" aria-hidden="true" focusable="false" role="img" data-uw-rm-br-ar-ref-lb="" data-uw-rm-sr="" data-uw-rm-br-ar-ref-ids-aria-labelledby="icon-69283c7b4f4c80000">
                <use href="https://www.jaeger-lecoultre.com/jlc/dist/assets/icons.svg?cacheKey=b81f1f6a799799d00514031b7b625ae3#info-12"></use>
    </svg>
            </span>
        </button>
    </div>

    <div id="tooltip-content-tooltip-69283c7b4f493" class="tooltip__content" role="tooltip">
        The balance makes a to-and-fro movement at a given frequency (two vibrations). It is measured either in Vibration per Hour (VPH) or Hertz (Hz).
    </div>
</div>

                    </div>

                    <div class="product-page-details__infos_text">
                                                    28800                                             </div>
                                    <div class="product-page-details__infos_start" data-tooltip-key="ProductPage.specification.standardizedFrequenceHz.tooltip">
                        <h5 class="product-page-details__infos_subtitle">Frequency (HZ)</h5>
                        <div id="tooltip-69283c7b4f555" class="tooltip tooltip--touch-enabled product-page-details__infos_subtitle__tooltip tooltip--minimal" data-options="{&quot;placement&quot;:&quot;top-start&quot;,&quot;enableArrow&quot;:false,&quot;offset&quot;:5,&quot;enableTouch&quot;:true}">
    <div class="tooltip__trigger" aria-describedby="tooltip-content-tooltip-69283c7b4f555" tabindex="0">
        <button type="button" class="btn btn--xs btn--default btn--icon-only btn--icon">
            <span class="sr-only">
                Discover more
            </span>

            <span class="btn__icon">
                <svg class="icon icon--info-12 icon--bidirectional icon--12" aria-hidden="true" focusable="false" role="img" data-uw-rm-br-ar-ref-lb="" data-uw-rm-sr="" data-uw-rm-br-ar-ref-ids-aria-labelledby="icon-69283c7b4f5740000">
                <use href="https://www.jaeger-lecoultre.com/jlc/dist/assets/icons.svg?cacheKey=b81f1f6a799799d00514031b7b625ae3#info-12"></use>
    </svg>
            </span>
        </button>
    </div>

    <div id="tooltip-content-tooltip-69283c7b4f555" class="tooltip__content" role="tooltip">
        The balance makes a to-and-fro movement at a given frequency (two vibrations). It is measured either in Vibration per Hour (VPH) or Hertz (Hz).
    </div>
</div>

                    </div>

                    <div class="product-page-details__infos_text">
                                                    4                                             </div>
                                    <div class="product-page-details__infos_start" data-tooltip-key="ProductPage.specification.standardizedPowerReserve.tooltip">
                        <h5 class="product-page-details__infos_subtitle">Power reserve</h5>
                        <div id="tooltip-69283c7b4f5de" class="tooltip tooltip--touch-enabled product-page-details__infos_subtitle__tooltip tooltip--minimal" data-options="{&quot;placement&quot;:&quot;top-start&quot;,&quot;enableArrow&quot;:false,&quot;offset&quot;:5,&quot;enableTouch&quot;:true}">
    <div class="tooltip__trigger" aria-describedby="tooltip-content-tooltip-69283c7b4f5de" tabindex="0">
        <button type="button" class="btn btn--xs btn--default btn--icon-only btn--icon">
            <span class="sr-only">
                Discover more
            </span>

            <span class="btn__icon">
                <svg class="icon icon--info-12 icon--bidirectional icon--12" aria-hidden="true" focusable="false" role="img" data-uw-rm-br-ar-ref-lb="" data-uw-rm-sr="" data-uw-rm-br-ar-ref-ids-aria-labelledby="icon-69283c7b4f5fa0000">
                <use href="https://www.jaeger-lecoultre.com/jlc/dist/assets/icons.svg?cacheKey=b81f1f6a799799d00514031b7b625ae3#info-12"></use>
    </svg>
            </span>
        </button>
    </div>

    <div id="tooltip-content-tooltip-69283c7b4f5de" class="tooltip__content" role="tooltip">
        The time the watch will continue to function before rewinding is necessary.
    </div>
</div>

                    </div>

                    <div class="product-page-details__infos_text">
                                                    70 hours                                             </div>
                                    <div class="product-page-details__infos_start" data-tooltip-key="ProductPage.specification.standardizedNumberOfPieces.tooltip">
                        <h5 class="product-page-details__infos_subtitle">Components</h5>
                                            </div>

                    <div class="product-page-details__infos_text">
                                                    218                                             </div>
                                    <div class="product-page-details__infos_start" data-tooltip-key="ProductPage.specification.standardizedNumberOfRubis.tooltip">
                        <h5 class="product-page-details__infos_subtitle">Jewels</h5>
                        <div id="tooltip-69283c7b4f68a" class="tooltip tooltip--touch-enabled product-page-details__infos_subtitle__tooltip tooltip--minimal" data-options="{&quot;placement&quot;:&quot;top-start&quot;,&quot;enableArrow&quot;:false,&quot;offset&quot;:5,&quot;enableTouch&quot;:true}">
    <div class="tooltip__trigger" aria-describedby="tooltip-content-tooltip-69283c7b4f68a" tabindex="0">
        <button type="button" class="btn btn--xs btn--default btn--icon-only btn--icon">
            <span class="sr-only">
                Discover more
            </span>

            <span class="btn__icon">
                <svg class="icon icon--info-12 icon--bidirectional icon--12" aria-hidden="true" focusable="false" role="img" data-uw-rm-br-ar-ref-lb="" data-uw-rm-sr="" data-uw-rm-br-ar-ref-ids-aria-labelledby="icon-69283c7b4f6a50000">
                <use href="https://www.jaeger-lecoultre.com/jlc/dist/assets/icons.svg?cacheKey=b81f1f6a799799d00514031b7b625ae3#info-12"></use>
    </svg>
            </span>
        </button>
    </div>

    <div id="tooltip-content-tooltip-69283c7b4f68a" class="tooltip__content" role="tooltip">
        Jewels are used as bearings for pivots to reduce friction in a watch movement.
    </div>
</div>

                    </div>

                    <div class="product-page-details__infos_text">
                                                    32                                             </div>
                                    <div class="product-page-details__infos_start" data-tooltip-key="ProductPage.specification.standardizedNumberOfBarrels.tooltip">
                        <h5 class="product-page-details__infos_subtitle">Barrel</h5>
                                            </div>

                    <div class="product-page-details__infos_text">
                                                    1                                             </div>
                            </div>

                            <div class="btn-grid mb-sm">
                                            <a href="https://www.jaeger-lecoultre.com/au-en/services/customer-care-watches" class="btn btn--default btn--sm btn--full btn--icon btn--centered-with-icon" data-uw-rm-brl="PR" data-uw-original-href="https://www.jaeger-lecoultre.com/au-en/services/customer-care-watches">
                            <span class="btn__text" data-uw-trigger="" data-uw-ignore-s25="" aria-haspopup="dialog">Maintenance advice</span>
                            <span class="btn__icon pointer-events-none">
                                <svg class="icon icon--arrow-16 icon--bidirectional " aria-hidden="true" focusable="false" role="img" data-uw-rm-br-ar-ref-lb="" data-uw-rm-sr="" data-uw-rm-br-ar-ref-ids-aria-labelledby="icon-69283c7b4f6f60000">
                <use href="https://www.jaeger-lecoultre.com/jlc/dist/assets/icons.svg?cacheKey=b81f1f6a799799d00514031b7b625ae3#arrow-16"></use>
    </svg>
                            </span>
                        </a>
                    
                                            <button id="download-manual-button" class="btn btn--default btn--sm btn--full btn--icon btn--centered-with-icon">
                            <span class="btn__text" data-uw-trigger="" data-uw-ignore-s25="" aria-haspopup="dialog">Download the user manual</span>
                            <span class="btn__icon pointer-events-none">
                                <svg class="icon icon--download-16 " aria-hidden="true" focusable="false" role="img" data-uw-rm-br-ar-ref-lb="" data-uw-rm-sr="" data-uw-rm-br-ar-ref-ids-aria-labelledby="icon-69283c7b4fcd60000">
                <use href="https://www.jaeger-lecoultre.com/jlc/dist/assets/icons.svg?cacheKey=b81f1f6a799799d00514031b7b625ae3#download-16"></use>
    </svg>
                            </span>
                        </button>
                                    </div>

                
                    </div>
    </li>
    
    
            <li class="menu__item accordion__item">
    <button class="accordion__title menu__entry menu__link menu__toggle accordion__toggle " data-toggle="collapse" data-target="#product-accordion-tab-straps-and-buckles" aria-expanded="false" data-cy="straps-included-accordion-toggle">
        Straps &amp; Buckles
        <svg class="icon icon--chevron-down-10 icon--12" focusable="false" aria-labelledby="icon-69283c7b4fee70000" role="img">
                    <title id="icon-69283c7b4fee70000">Straps &amp; Buckles</title>
                <use href="https://www.jaeger-lecoultre.com/jlc/dist/assets/icons.svg?cacheKey=b81f1f6a799799d00514031b7b625ae3#chevron-down-10"></use>
    </svg>
    </button>

            <div id="product-accordion-tab-straps-and-buckles" class="accordion__content collapse">
            
                <div class="product-page-details__infos_start" data-tooltip-key="ProductPage.specification.strap.tooltip">
                    <h3 class="product-page-details__infos_subtitle">Strap</h3>
                                    </div>

                <div class="product-page-details__infos_text">
                                            Interchangeable: Crafted with quick-release technology for seamless strap interchangeability <br>                                            Standard strand length at 12h: 75mm <br>                                            Length 6h: 120mm <br>                                            Lug width: 21mm                                     </div>
                            <div class="product-page-details__infos_start" data-tooltip-key="ProductPage.specification.buckle.tooltip">
                    <h3 class="product-page-details__infos_subtitle">Buckle</h3>
                                    </div>

                <div class="product-page-details__infos_text">
                                            Double Folding Buckle <br>                                            Stainless steel <br>                                            Buckle width: 18mm                                     </div>

                
                    </div>
    </li>
    </ul>


                        
                                                    <h2 class="mt-md h5 mb-base">Color and material variants</h2>

    <div class="product-page-details__variants--slider">
        <div id="phx-product-variants" class="slider slider--linear slider--footer-inset slider--faded slider--initialized slider--horizontal slider--free-mode slider--watch-progress slider--backface-hidden slider-faded--end-visible" aria-roledescription="carousel" aria-label="Product variants">
            <div class="slider__body" aria-atomic="false" aria-live="polite" style="transform: translate3d(0px, 0px, 0px);">
                                    <div class="slider__item swiper-slide-visible swiper-slide-fully-visible slider__item--active" aria-roledescription="slide" aria-label="Master Ultra Thin Moon">
                        <a href="https://www.jaeger-lecoultre.com/au-en/watches/master-ultra-thin/master-ultra-thin-moon-steel-q1368460" data-tracking="{&quot;event&quot;:&quot;item_variant&quot;,&quot;variant_id&quot;:&quot;Q1368460&quot;,&quot;items&quot;:[{&quot;item_id&quot;:&quot;Q1238460&quot;,&quot;item_name&quot;:&quot;Date&quot;,&quot;item_brand&quot;:&quot;jlc&quot;,&quot;item_category&quot;:&quot;Watches&quot;,&quot;item_collection&quot;:&quot;Master Ultra Thin&quot;,&quot;item_sellable&quot;:&quot;sellable&quot;,&quot;currency&quot;:&quot;AUD&quot;,&quot;price&quot;:&quot;16300.00&quot;,&quot;item_variant&quot;:&quot;&quot;,&quot;item_line&quot;:&quot;&quot;}]}" class="picture picture--actionable picture--full btn btn--default product-page-details__variant" tabindex="0" data-uw-rm-brl="PR" data-uw-original-href="https://www.jaeger-lecoultre.com/au-en/watches/master-ultra-thin/master-ultra-thin-moon-steel-q1368460">
                            <div class="picture">
                                <picture>
                                    <source srcset="https://img.jaeger-lecoultre.com/product-thumb-sm-5/o-dpr-2/ed3cf9bdcc2dc1863218f6ddd2d7f70fbbc6d9d6.jpg 2x, https://img.jaeger-lecoultre.com/product-thumb-sm-5/ed3cf9bdcc2dc1863218f6ddd2d7f70fbbc6d9d6.jpg 1x" data-srcset="https://img.jaeger-lecoultre.com/product-thumb-sm-5/o-dpr-2/ed3cf9bdcc2dc1863218f6ddd2d7f70fbbc6d9d6.jpg 2x, https://img.jaeger-lecoultre.com/product-thumb-sm-5/ed3cf9bdcc2dc1863218f6ddd2d7f70fbbc6d9d6.jpg 1x" media="(min-width: 568px)">
            
            <img src="https://img.jaeger-lecoultre.com/product-thumb-5/ed3cf9bdcc2dc1863218f6ddd2d7f70fbbc6d9d6.jpg" data-src="https://img.jaeger-lecoultre.com/product-thumb-5/ed3cf9bdcc2dc1863218f6ddd2d7f70fbbc6d9d6.jpg" data-srcset="https://img.jaeger-lecoultre.com/product-thumb-5/o-dpr-2/ed3cf9bdcc2dc1863218f6ddd2d7f70fbbc6d9d6.jpg 2x, https://img.jaeger-lecoultre.com/product-thumb-5/ed3cf9bdcc2dc1863218f6ddd2d7f70fbbc6d9d6.jpg 1x" alt="Moon " class=" lazyloaded" srcset="https://img.jaeger-lecoultre.com/product-thumb-5/o-dpr-2/ed3cf9bdcc2dc1863218f6ddd2d7f70fbbc6d9d6.jpg 2x, https://img.jaeger-lecoultre.com/product-thumb-5/ed3cf9bdcc2dc1863218f6ddd2d7f70fbbc6d9d6.jpg 1x" data-uw-rm-alt-original="Moon " data-uw-rm-alt="ALT">

            <noscript>
                <img src="https://img.jaeger-lecoultre.com/product-thumb-5/ed3cf9bdcc2dc1863218f6ddd2d7f70fbbc6d9d6.jpg"
                    alt="Moon "
                    class=" "
                >
            </noscript>
            </picture>
                            </div>
                        </a>
                    </div>
                            </div>
        </div>
    </div>

                         
                                                    <div class="mt-lg">
                                <div class="reassurance-banner reassurance-banner--column page_speed_398520035">
                                      <button class="reassurance-banner__item" data-modal-open="modal-item-69283c7ade3930000" aria-label="FREE DELIVERY &amp; RETURNS" data-uw-rm-empty-ctrl="">
    <svg class="icon icon--delivery-24 icon--24" aria-hidden="true" focusable="false" role="img" data-uw-rm-br-ar-ref-lb="" data-uw-rm-sr="" data-uw-rm-br-ar-ref-ids-aria-labelledby="icon-69283c7b5079b0000">
                <use href="https://www.jaeger-lecoultre.com/jlc/dist/assets/icons.svg?cacheKey=b81f1f6a799799d00514031b7b625ae3#delivery-24"></use>
    </svg>

    <div class="h5 reassurance-banner__title">FREE DELIVERY &amp; RETURNS</div>

            <svg class="icon icon--plus-alt-16 icon--16 reassurance-banner--column__icon-end" aria-hidden="true" focusable="false" role="img" data-uw-rm-br-ar-ref-lb="" data-uw-rm-sr="" data-uw-rm-br-ar-ref-ids-aria-labelledby="icon-69283c7b507b00000">
                <use href="https://www.jaeger-lecoultre.com/jlc/dist/assets/icons.svg?cacheKey=b81f1f6a799799d00514031b7b625ae3#plus-alt-16"></use>
    </svg>
    </button>
                                                                            <button class="reassurance-banner__item" data-modal-open="modal-item-69283c7ade4b80000" aria-label="SECURE PAYMENT" data-uw-rm-empty-ctrl="">
    <svg class="icon icon--credit-card-24 icon--24" aria-hidden="true" focusable="false" role="img" data-uw-rm-br-ar-ref-lb="" data-uw-rm-sr="" data-uw-rm-br-ar-ref-ids-aria-labelledby="icon-69283c7b507d20000">
                <use href="https://www.jaeger-lecoultre.com/jlc/dist/assets/icons.svg?cacheKey=b81f1f6a799799d00514031b7b625ae3#credit-card-24"></use>
    </svg>

    <div class="h5 reassurance-banner__title">SECURE PAYMENT</div>

            <svg class="icon icon--plus-alt-16 icon--16 reassurance-banner--column__icon-end" aria-hidden="true" focusable="false" role="img" data-uw-rm-br-ar-ref-lb="" data-uw-rm-sr="" data-uw-rm-br-ar-ref-ids-aria-labelledby="icon-69283c7b507e00000">
                <use href="https://www.jaeger-lecoultre.com/jlc/dist/assets/icons.svg?cacheKey=b81f1f6a799799d00514031b7b625ae3#plus-alt-16"></use>
    </svg>
    </button>
                                                                            <button class="reassurance-banner__item" data-modal-open="modal-item-69283c7ade5c30000" aria-label="SWISS MADE" data-uw-rm-empty-ctrl="">
    <svg class="icon icon--swiss-made-24 icon--24" aria-hidden="true" focusable="false" role="img" data-uw-rm-br-ar-ref-lb="" data-uw-rm-sr="" data-uw-rm-br-ar-ref-ids-aria-labelledby="icon-69283c7b507fc0000">
                <use href="https://www.jaeger-lecoultre.com/jlc/dist/assets/icons.svg?cacheKey=b81f1f6a799799d00514031b7b625ae3#swiss-made-24"></use>
    </svg>

    <div class="h5 reassurance-banner__title">SWISS MADE</div>

            <svg class="icon icon--plus-alt-16 icon--16 reassurance-banner--column__icon-end" aria-hidden="true" focusable="false" role="img" data-uw-rm-br-ar-ref-lb="" data-uw-rm-sr="" data-uw-rm-br-ar-ref-ids-aria-labelledby="icon-69283c7b508090000">
                <use href="https://www.jaeger-lecoultre.com/jlc/dist/assets/icons.svg?cacheKey=b81f1f6a799799d00514031b7b625ae3#plus-alt-16"></use>
    </svg>
    </button>
                                                                            <button class="reassurance-banner__item" data-modal-open="modal-item-69283c7ade6ca0000" aria-label="UP TO 8 YEARS OF WARRANTY" data-uw-rm-empty-ctrl="">
    <svg class="icon icon--care-24 icon--24" aria-hidden="true" focusable="false" role="img" data-uw-rm-br-ar-ref-lb="" data-uw-rm-sr="" data-uw-rm-br-ar-ref-ids-aria-labelledby="icon-69283c7b508290000">
                <use href="https://www.jaeger-lecoultre.com/jlc/dist/assets/icons.svg?cacheKey=b81f1f6a799799d00514031b7b625ae3#care-24"></use>
    </svg>

    <div class="h5 reassurance-banner__title">UP TO 8 YEARS OF WARRANTY</div>

            <svg class="icon icon--plus-alt-16 icon--16 reassurance-banner--column__icon-end" aria-hidden="true" focusable="false" role="img" data-uw-rm-br-ar-ref-lb="" data-uw-rm-sr="" data-uw-rm-br-ar-ref-ids-aria-labelledby="icon-69283c7b508360000">
                <use href="https://www.jaeger-lecoultre.com/jlc/dist/assets/icons.svg?cacheKey=b81f1f6a799799d00514031b7b625ae3#plus-alt-16"></use>
    </svg>
    </button>
                                                                            <button class="reassurance-banner__item" data-modal-open="modal-item-69283c7ade7cc0000" aria-label="AFTER-SALE SERVICES" data-uw-rm-empty-ctrl="">
    <svg class="icon icon--watch-maker-24 icon--24" aria-hidden="true" focusable="false" role="img" data-uw-rm-br-ar-ref-lb="" data-uw-rm-sr="" data-uw-rm-br-ar-ref-ids-aria-labelledby="icon-69283c7b508500000">
                <use href="https://www.jaeger-lecoultre.com/jlc/dist/assets/icons.svg?cacheKey=b81f1f6a799799d00514031b7b625ae3#watch-maker-24"></use>
    </svg>

    <div class="h5 reassurance-banner__title">AFTER-SALE SERVICES</div>

            <svg class="icon icon--plus-alt-16 icon--16 reassurance-banner--column__icon-end" aria-hidden="true" focusable="false" role="img" data-uw-rm-br-ar-ref-lb="" data-uw-rm-sr="" data-uw-rm-br-ar-ref-ids-aria-labelledby="icon-69283c7b5085d0000">
                <use href="https://www.jaeger-lecoultre.com/jlc/dist/assets/icons.svg?cacheKey=b81f1f6a799799d00514031b7b625ae3#plus-alt-16"></use>
    </svg>
    </button>
                                                                    </div>
                            </div>
                        
                        
                        
                        
                                                    <h5 class="mt-md mb-sm" role="heading" aria-level="3" data-uw-rm-heading="level">Personalise your watch</h5>
                            <div class="duo-button duo-button--stacked duo-button--full">
                                <div class="duo-button__wrapper">
                                                                            <a href="https://www.jaeger-lecoultre.com/au-en/strap-search?reference=Q1238460" class="btn btn--default btn--xs btn--even btn--outlined btn--full btn--icon btn--description-icons-start-end" data-uw-rm-brl="PR" data-uw-original-href="https://www.jaeger-lecoultre.com/au-en/strap-search?reference=Q1238460" aria-label="search" data-uw-rm-empty-ctrl="">
                                        <span class="btn__icon btn__icon--start">
                                            <svg class="icon icon--strap-watch-36 icon--36" aria-hidden="true" focusable="false" role="img" data-uw-rm-br-ar-ref-lb="" data-uw-rm-sr="" data-uw-rm-br-ar-ref-ids-aria-labelledby="icon-69283c7b508800000">
                <use href="https://www.jaeger-lecoultre.com/jlc/dist/assets/icons.svg?cacheKey=b81f1f6a799799d00514031b7b625ae3#strap-watch-36"></use>
    </svg>
                                        </span>

                                            <span class="btn__text" data-description="Add another compatible strap" data-uw-trigger="" data-uw-ignore-s25="" aria-haspopup="dialog">
                                            Strap finder
                                        </span>

                                            <span class="btn__icon btn__icon--end">
                                            <svg class="icon icon--arrow-16 icon--bidirectional " aria-hidden="true" focusable="false" role="img" data-uw-rm-br-ar-ref-lb="" data-uw-rm-sr="" data-uw-rm-br-ar-ref-ids-aria-labelledby="icon-69283c7b508920000">
                <use href="https://www.jaeger-lecoultre.com/jlc/dist/assets/icons.svg?cacheKey=b81f1f6a799799d00514031b7b625ae3#arrow-16"></use>
    </svg>
                                        </span>
                                        </a>
                                                                    </div>
                            </div>
                                            </div>



Polaris
<a href="https://www.jaeger-lecoultre.com/au-en/watches/polaris/polaris-perpetual-calendar-pink-gold-q9082681" class="product-card__link" data-tracking="{&quot;event&quot;:&quot;select_item&quot;,&quot;ecommerce&quot;:{&quot;currency&quot;:&quot;AUD&quot;,&quot;items&quot;:[{&quot;item_id&quot;:&quot;Q9082681&quot;,&quot;item_name&quot;:&quot;Perpetual Calendar&quot;,&quot;item_brand&quot;:&quot;jlc&quot;,&quot;item_category&quot;:&quot;Watches&quot;,&quot;item_collection&quot;:&quot;Polaris&quot;,&quot;item_sellable&quot;:&quot;sellable&quot;,&quot;currency&quot;:&quot;AUD&quot;,&quot;price&quot;:&quot;92000.00&quot;,&quot;item_variant&quot;:&quot;&quot;,&quot;item_line&quot;:&quot;&quot;}],&quot;_currency&quot;:{&quot;AU&quot;:&quot;AUD&quot;}}}"><div class="simple-slider product-card__slider" style="pointer-events: auto;"><div class="simple-slider__body"><div class="simple-slider__slide product-card__picture"><div class="picture"><picture><source media="(min-width: 768px)" srcset="https://img.jaeger-lecoultre.com/product-card-md-3/o-dpr-2/2a18ba84be2e2573f620f228c3a561d66582518c.jpg 2x, https://img.jaeger-lecoultre.com/product-card-md-3/2a18ba84be2e2573f620f228c3a561d66582518c.jpg 1x" data-srcset="https://img.jaeger-lecoultre.com/product-card-md-3/o-dpr-2/2a18ba84be2e2573f620f228c3a561d66582518c.jpg 2x, https://img.jaeger-lecoultre.com/product-card-md-3/2a18ba84be2e2573f620f228c3a561d66582518c.jpg 1x"><source media="(min-width: 568px)" srcset="https://img.jaeger-lecoultre.com/product-card-sm-3/o-dpr-2/2a18ba84be2e2573f620f228c3a561d66582518c.jpg 2x, https://img.jaeger-lecoultre.com/product-card-sm-3/2a18ba84be2e2573f620f228c3a561d66582518c.jpg 1x" data-srcset="https://img.jaeger-lecoultre.com/product-card-sm-3/o-dpr-2/2a18ba84be2e2573f620f228c3a561d66582518c.jpg 2x, https://img.jaeger-lecoultre.com/product-card-sm-3/2a18ba84be2e2573f620f228c3a561d66582518c.jpg 1x"><img src="https://img.jaeger-lecoultre.com/product-card-3/2a18ba84be2e2573f620f228c3a561d66582518c.jpg" data-src="https://img.jaeger-lecoultre.com/product-card-3/2a18ba84be2e2573f620f228c3a561d66582518c.jpg" data-srcset="https://img.jaeger-lecoultre.com/product-card-3/o-dpr-2/2a18ba84be2e2573f620f228c3a561d66582518c.jpg 2x, https://img.jaeger-lecoultre.com/product-card-3/2a18ba84be2e2573f620f228c3a561d66582518c.jpg 1x" class=" ls-is-cached lazyloaded" alt="Perpetual Calendar" srcset="https://img.jaeger-lecoultre.com/product-card-3/o-dpr-2/2a18ba84be2e2573f620f228c3a561d66582518c.jpg 2x, https://img.jaeger-lecoultre.com/product-card-3/2a18ba84be2e2573f620f228c3a561d66582518c.jpg 1x"></picture></div></div><div class="simple-slider__slide product-card__picture"><div class="picture"><picture><source media="(min-width: 768px)" srcset="https://img.jaeger-lecoultre.com/product-card-md-3/o-dpr-2/fe5877fa0488758e4b95842426a3a5f641967919.jpg 2x, https://img.jaeger-lecoultre.com/product-card-md-3/fe5877fa0488758e4b95842426a3a5f641967919.jpg 1x" data-srcset="https://img.jaeger-lecoultre.com/product-card-md-3/o-dpr-2/fe5877fa0488758e4b95842426a3a5f641967919.jpg 2x, https://img.jaeger-lecoultre.com/product-card-md-3/fe5877fa0488758e4b95842426a3a5f641967919.jpg 1x"><source media="(min-width: 568px)" srcset="https://img.jaeger-lecoultre.com/product-card-sm-3/o-dpr-2/fe5877fa0488758e4b95842426a3a5f641967919.jpg 2x, https://img.jaeger-lecoultre.com/product-card-sm-3/fe5877fa0488758e4b95842426a3a5f641967919.jpg 1x" data-srcset="https://img.jaeger-lecoultre.com/product-card-sm-3/o-dpr-2/fe5877fa0488758e4b95842426a3a5f641967919.jpg 2x, https://img.jaeger-lecoultre.com/product-card-sm-3/fe5877fa0488758e4b95842426a3a5f641967919.jpg 1x"><img src="https://img.jaeger-lecoultre.com/product-card-3/fe5877fa0488758e4b95842426a3a5f641967919.jpg" data-src="https://img.jaeger-lecoultre.com/product-card-3/fe5877fa0488758e4b95842426a3a5f641967919.jpg" data-srcset="https://img.jaeger-lecoultre.com/product-card-3/o-dpr-2/fe5877fa0488758e4b95842426a3a5f641967919.jpg 2x, https://img.jaeger-lecoultre.com/product-card-3/fe5877fa0488758e4b95842426a3a5f641967919.jpg 1x" class=" ls-is-cached lazyloaded" alt="Perpetual Calendar" srcset="https://img.jaeger-lecoultre.com/product-card-3/o-dpr-2/fe5877fa0488758e4b95842426a3a5f641967919.jpg 2x, https://img.jaeger-lecoultre.com/product-card-3/fe5877fa0488758e4b95842426a3a5f641967919.jpg 1x"></picture></div></div></div><div class="product-card__slider-pagination"><span class="simple-slider__pagination-bullet simple-slider__pagination-bullet--active"></span><span class="simple-slider__pagination-bullet"></span></div></div><div class="product-card__body"><div class="product-card__details"><div class="product-card__tags" data-cy="product-tags"><span class="tag product-card__tag">New</span></div><h5 class="product-card__collection">Polaris</h5><h5 class="product-card__name">Perpetual Calendar</h5><div class="product-card__specs">42 mm Automatic Pink Gold Perpetual Calendar Watch</div><div class="product-price product-card__price product-price--thin product-price--small"><span><span data-price="currency" class="" data-cy="price-currency">AU$</span> <span data-price="value">92,000</span></span></div></div></div></a>

images, specs, prices, details
<div class="product-page-details__infos" data-cy="product-page-details-top">
                        <div class="hidden md:block">
                            <div class="product-page-details__tags" data-cy="product-tags">
                    <span class="tag product-page-details__tag">New</span>
            </div>

<div class="product-page-details__title-price-wrapper">
    <h1 class="product-page-details__title h3">
        Polaris<br>
        <span class="product-page-details__subtitle">Perpetual Calendar</span>
    </h1>

            <div class="product-price country-reveal-container">
            <span class="price-from--prices "><span data-country-code="AU" class=""><span class="product-price__value">
                    <span data-price="currency" class="">AU$</span>
            <span data-price="value">92,000</span>
            </span>

            <span class="product-price__vat hidden">Price including taxes</span>
    </span></span>
        </div>
    </div>


    <div class="product-page-details__resume text--muted">
        <span class="block">42 mm Automatic Pink Gold Perpetual Calendar Watch</span>

            </div>
                        </div>

                        <div class="btn-grid--xs mb-sm country-reveal-container" data-cy="product-cta-container">
                                                            
                                                                    <a href="tel:+61 2 8663 8028" type="button" class="btn btn--default btn--icon btn--full btn--negative" data-cy="shop-by-phone-btn" data-country-code="AU" data-tracking="{&quot;event&quot;:&quot;call_center&quot;,&quot;button_position&quot;:&quot;product_page&quot;,&quot;button_type&quot;:&quot;buy&quot;,&quot;items&quot;:[{&quot;item_id&quot;:&quot;Q9082681&quot;,&quot;item_name&quot;:&quot;Perpetual Calendar&quot;,&quot;item_brand&quot;:&quot;jlc&quot;,&quot;item_category&quot;:&quot;Watches&quot;,&quot;item_collection&quot;:&quot;Polaris&quot;,&quot;item_sellable&quot;:&quot;sellable&quot;,&quot;currency&quot;:&quot;AUD&quot;,&quot;price&quot;:&quot;92000.00&quot;,&quot;item_variant&quot;:&quot;&quot;,&quot;item_line&quot;:&quot;&quot;}]}" data-algolia-insights="{&quot;objectIDs&quot;:[&quot;Page::4517&quot;],&quot;index&quot;:&quot;products&quot;,&quot;eventName&quot;:&quot;Product converted&quot;,&quot;type&quot;:&quot;conversion&quot;}">
        <span class="btn__text" data-uw-trigger="" data-uw-ignore-s25="" aria-haspopup="dialog">Inquire by phone</span>

                    <span class="btn__icon pointer-events-none">
                <svg class="icon icon--phone-16 " aria-hidden="true" focusable="false" aria-labelledby="icon-6928254d7653f0000" role="img">
                <use href="https://www.jaeger-lecoultre.com/jlc/dist/assets/icons.svg?cacheKey=b81f1f6a799799d00514031b7b625ae3#phone-16"></use>
    </svg>
            </span>
            </a>
                                
                                                                    <button id="boutique-stock-availability-modal-button" type="button" class="btn btn--default btn--full btn--icon" data-tracking="{&quot;event&quot;:&quot;try_in_boutique&quot;,&quot;items&quot;:[{&quot;item_id&quot;:&quot;Q9082681&quot;,&quot;item_name&quot;:&quot;Perpetual Calendar&quot;,&quot;item_brand&quot;:&quot;jlc&quot;,&quot;item_category&quot;:&quot;Watches&quot;,&quot;item_collection&quot;:&quot;Polaris&quot;,&quot;item_sellable&quot;:&quot;sellable&quot;,&quot;currency&quot;:&quot;AUD&quot;,&quot;price&quot;:&quot;92000.00&quot;,&quot;item_variant&quot;:&quot;&quot;,&quot;item_line&quot;:&quot;&quot;}]}" data-modal-open="boutique-stock-availability-modal" data-cy="btn-find-in-boutique" data-algolia-insights="{&quot;objectIDs&quot;:[&quot;Page::4517&quot;],&quot;index&quot;:&quot;products&quot;,&quot;eventName&quot;:&quot;Product converted&quot;,&quot;type&quot;:&quot;conversion&quot;}">
    <span class="btn__text" data-uw-trigger="" data-uw-ignore-s25="" aria-haspopup="dialog">Availability in boutique</span>
    <span class="btn__icon pointer-events-none">
        <svg class="icon icon--pin-16 " aria-hidden="true" focusable="false" aria-labelledby="icon-6928254d765e70000" role="img">
                <use href="https://www.jaeger-lecoultre.com/jlc/dist/assets/icons.svg?cacheKey=b81f1f6a799799d00514031b7b625ae3#pin-16"></use>
    </svg>
    </span>
</button>
                                
                                <a href="https://www.jaeger-lecoultre.com/au-en/boutique-appointment?reference=Q9082681" type="button" class="btn btn--default btn--full btn--icon" data-tracking="{&quot;event&quot;:&quot;baa_selected&quot;,&quot;boutique_id&quot;:null}" data-algolia-insights="{&quot;objectIDs&quot;:[&quot;Page::4517&quot;],&quot;index&quot;:&quot;products&quot;,&quot;eventName&quot;:&quot;Product converted&quot;,&quot;type&quot;:&quot;conversion&quot;}">
    <span class="btn__text" data-uw-trigger="" data-uw-ignore-s25="" aria-haspopup="dialog">Book an appointment</span>
    <span class="btn__icon pointer-events-none">
        <svg class="icon icon--clock-16 " aria-hidden="true" focusable="false" aria-labelledby="icon-6928254d766600000" role="img">
                <use href="https://www.jaeger-lecoultre.com/jlc/dist/assets/icons.svg?cacheKey=b81f1f6a799799d00514031b7b625ae3#clock-16"></use>
    </svg>
    </span>
</a>

                                <a href="https://wa.me/+61483905200" target="_blank" type="button" data-tracking="{&quot;event&quot;:&quot;whatsapp&quot;,&quot;items&quot;:[{&quot;item_id&quot;:&quot;Q9082681&quot;,&quot;item_name&quot;:&quot;Perpetual Calendar&quot;,&quot;item_brand&quot;:&quot;jlc&quot;,&quot;item_category&quot;:&quot;Watches&quot;,&quot;item_collection&quot;:&quot;Polaris&quot;,&quot;item_sellable&quot;:&quot;sellable&quot;,&quot;currency&quot;:&quot;AUD&quot;,&quot;price&quot;:&quot;92000.00&quot;,&quot;item_variant&quot;:&quot;&quot;,&quot;item_line&quot;:&quot;&quot;}]}" class="btn btn--default btn--full" data-algolia-insights="{&quot;objectIDs&quot;:[&quot;Page::4517&quot;],&quot;index&quot;:&quot;products&quot;,&quot;eventName&quot;:&quot;Product converted&quot;,&quot;type&quot;:&quot;conversion&quot;}">
        <span class="btn__text" data-uw-trigger="" data-uw-ignore-s25="" aria-haspopup="dialog">WhatsApp</span>
        <span class="btn__icon pointer-events-none">
            <svg class="icon icon--whatsapp-16 " aria-hidden="true" focusable="false" aria-labelledby="icon-6928254d76a580000" role="img">
                <use href="https://www.jaeger-lecoultre.com/jlc/dist/assets/icons.svg?cacheKey=b81f1f6a799799d00514031b7b625ae3#whatsapp-16"></use>
    </svg>
        </span>
    </a>

                                
                                                                    <span id="show-sticky-add-to-bag"></span>
                                                                                    </div>

                        
                        
                        <ul class="accordion menu menu--border-full-width product-page-details__description-accordion">
    
    <li class="menu__item accordion__item">
    <button class="accordion__title menu__entry menu__link menu__toggle accordion__toggle " data-toggle="collapse" data-target="#product-accordion-tab-description" aria-expanded="false">
        Description
        <svg class="icon icon--chevron-down-10 icon--12" focusable="false" aria-labelledby="icon-6928254d773970000" role="img">
                    <title id="icon-6928254d773970000">Description</title>
                <use href="https://www.jaeger-lecoultre.com/jlc/dist/assets/icons.svg?cacheKey=b81f1f6a799799d00514031b7b625ae3#chevron-down-10"></use>
    </svg>
    </button>

            <div id="product-accordion-tab-description" class="accordion__content collapse">
            
                <div class="product-page-details__infos_text">
            The perpetual calendar is considered one of the most complex horological complications to master. Athletic and elegant, the new Polaris Perpetual Calendar in pink gold invites the modern-day adventurer to experience an almost-perpetual precision. Beneath the sapphire case-back, the new Jaeger-LeCoultre Caliber 868 designed, produced and assembled in the Manufacture reveals its 351 components. The innovations embodied in this movement include a moon phase in both hemispheres, equipped with a retrograde hand for the southern hemisphere. Enhanced by the pink gold bezel and lugs, the lacquered dial features a superb gradient of blue tones. Against this oceanic blue, the luminescent hands and hour-markers stand out, alongside the perpetual calendar and moon phase indications. The Polaris Perpetual Calendar is also offered with a duo of easily interchangeable straps – one in blue rubber, the other in black alligator with a folding clasp.
        </div>

                
                    </div>
    </li>

    
    <li class="menu__item accordion__item">
    <button class="accordion__title menu__entry menu__link menu__toggle accordion__toggle " data-toggle="collapse" data-target="#product-accordion-tab-feature" aria-expanded="false">
        Features
        <svg class="icon icon--chevron-down-10 icon--12" focusable="false" aria-labelledby="icon-6928254d776f20000" role="img">
                    <title id="icon-6928254d776f20000">Features</title>
                <use href="https://www.jaeger-lecoultre.com/jlc/dist/assets/icons.svg?cacheKey=b81f1f6a799799d00514031b7b625ae3#chevron-down-10"></use>
    </svg>
    </button>

            <div id="product-accordion-tab-feature" class="accordion__content collapse">
            
                <div class="product-page-details__infos_start" data-tooltip-key="ProductPage.specification.case.tooltip">
                <h3 class="product-page-details__infos_subtitle">Case</h3>
                            </div>

            <div class="product-page-details__infos_text">
                                    Pink Gold 750/1000 (18 carats) <br>                                    Diameter: 42 MM <br>                                    Thickness: 11.97mm                             </div>
                    <div class="product-page-details__infos_start" data-tooltip-key="ProductPage.specification.waterResistance.tooltip">
                <h3 class="product-page-details__infos_subtitle">Water resistance</h3>
                            </div>

            <div class="product-page-details__infos_text">
                                    10 bar                             </div>
                    <div class="product-page-details__infos_start" data-tooltip-key="ProductPage.specification.dial.tooltip">
                <h3 class="product-page-details__infos_subtitle">Dial</h3>
                            </div>

            <div class="product-page-details__infos_text">
                                    Polished 4N appliques, Blue, Grained                             </div>

                
                    </div>
    </li>


            
        <li class="menu__item accordion__item">
    <button class="accordion__title menu__entry menu__link menu__toggle accordion__toggle " data-toggle="collapse" data-target="#product-accordion-tab-movement" aria-expanded="false">
        Movement
        <svg class="icon icon--chevron-down-10 icon--12" focusable="false" aria-labelledby="icon-6928254d7916b0000" role="img">
                    <title id="icon-6928254d7916b0000">Movement</title>
                <use href="https://www.jaeger-lecoultre.com/jlc/dist/assets/icons.svg?cacheKey=b81f1f6a799799d00514031b7b625ae3#chevron-down-10"></use>
    </svg>
    </button>

            <div id="product-accordion-tab-movement" class="accordion__content collapse">
            
                <div class="mb-sm text-center bg-media">
                    <div class="picture">
                        <picture>
                    
            <img src="data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width=%22250%22%20height=%22250%22%20viewBox%3D%220%200%20250%20250%22%3E%3C%2Fsvg%3E" data-src="https://img.jaeger-lecoultre.com/product-specifications-movement-1/4113a74753d9bcdfa240d9ac824f4d51abcd066a.jpg" data-srcset="https://img.jaeger-lecoultre.com/product-specifications-movement-1/o-dpr-2/4113a74753d9bcdfa240d9ac824f4d51abcd066a.jpg 2x, https://img.jaeger-lecoultre.com/product-specifications-movement-1/4113a74753d9bcdfa240d9ac824f4d51abcd066a.jpg 1x" alt="Jaeger-LeCoultre Calibre 868" class="lazyload m-auto ">

            <noscript>
                <img src="https://img.jaeger-lecoultre.com/product-specifications-movement-1/4113a74753d9bcdfa240d9ac824f4d51abcd066a.jpg"
                    alt="Jaeger-LeCoultre Calibre 868"
                    class="m-auto "
                >
            </noscript>
            </picture>
                    </div>
                </div>
            
            <h3 class="product-page-details__infos_title h5">Jaeger-LeCoultre Calibre 868</h3>
            <div class="product-page-details__infos-side-by-side">
                                    <div class="product-page-details__infos_start" data-tooltip-key="ProductPage.specification.standardizedEnergy.tooltip">
                        <h5 class="product-page-details__infos_subtitle">MOVEMENT TYPE</h5>
                                            </div>

                    <div class="product-page-details__infos_text">
                                                    Automatic winding                                             </div>
                                    <div class="product-page-details__infos_start" data-tooltip-key="ProductPage.specification.functions.tooltip">
                        <h5 class="product-page-details__infos_subtitle">Functions</h5>
                                            </div>

                    <div class="product-page-details__infos_text">
                                                    Seconds, Date, Day, Moon phases of the 2 hemispheres, Perpetual calendar, Rotating rehaut, Red security zone, Month, Year, Hour - Minute, Southern Hemisphere retrograde moon phases                                             </div>
                                    <div class="product-page-details__infos_start" data-tooltip-key="ProductPage.specification.standardizedThickness.tooltip">
                        <h5 class="product-page-details__infos_subtitle">Thickness</h5>
                                            </div>

                    <div class="product-page-details__infos_text">
                                                    4.72mm                                             </div>
                                    <div class="product-page-details__infos_start" data-tooltip-key="ProductPage.specification.standardizedFrequenceVph.tooltip">
                        <h5 class="product-page-details__infos_subtitle">Vibrations per hour</h5>
                        <div id="tooltip-6928254d78766" class="tooltip tooltip--touch-enabled product-page-details__infos_subtitle__tooltip tooltip--minimal" data-options="{&quot;placement&quot;:&quot;top-start&quot;,&quot;enableArrow&quot;:false,&quot;offset&quot;:5,&quot;enableTouch&quot;:true}">
    <div class="tooltip__trigger" aria-describedby="tooltip-content-tooltip-6928254d78766" tabindex="0">
        <button type="button" class="btn btn--xs btn--default btn--icon-only btn--icon">
            <span class="sr-only">
                Discover more
            </span>

            <span class="btn__icon">
                <svg class="icon icon--info-12 icon--bidirectional icon--12" aria-hidden="true" focusable="false" aria-labelledby="icon-6928254d787990000" role="img">
                <use href="https://www.jaeger-lecoultre.com/jlc/dist/assets/icons.svg?cacheKey=b81f1f6a799799d00514031b7b625ae3#info-12"></use>
    </svg>
            </span>
        </button>
    </div>

    <div id="tooltip-content-tooltip-6928254d78766" class="tooltip__content" role="tooltip">
        The balance makes a to-and-fro movement at a given frequency (two vibrations). It is measured either in Vibration per Hour (VPH) or Hertz (Hz).
    </div>
</div>

                    </div>

                    <div class="product-page-details__infos_text">
                                                    28800                                             </div>
                                    <div class="product-page-details__infos_start" data-tooltip-key="ProductPage.specification.standardizedFrequenceHz.tooltip">
                        <h5 class="product-page-details__infos_subtitle">Frequency (HZ)</h5>
                        <div id="tooltip-6928254d78819" class="tooltip tooltip--touch-enabled product-page-details__infos_subtitle__tooltip tooltip--minimal" data-options="{&quot;placement&quot;:&quot;top-start&quot;,&quot;enableArrow&quot;:false,&quot;offset&quot;:5,&quot;enableTouch&quot;:true}">
    <div class="tooltip__trigger" aria-describedby="tooltip-content-tooltip-6928254d78819" tabindex="0">
        <button type="button" class="btn btn--xs btn--default btn--icon-only btn--icon">
            <span class="sr-only">
                Discover more
            </span>

            <span class="btn__icon">
                <svg class="icon icon--info-12 icon--bidirectional icon--12" aria-hidden="true" focusable="false" aria-labelledby="icon-6928254d788360000" role="img">
                <use href="https://www.jaeger-lecoultre.com/jlc/dist/assets/icons.svg?cacheKey=b81f1f6a799799d00514031b7b625ae3#info-12"></use>
    </svg>
            </span>
        </button>
    </div>

    <div id="tooltip-content-tooltip-6928254d78819" class="tooltip__content" role="tooltip">
        The balance makes a to-and-fro movement at a given frequency (two vibrations). It is measured either in Vibration per Hour (VPH) or Hertz (Hz).
    </div>
</div>

                    </div>

                    <div class="product-page-details__infos_text">
                                                    4                                             </div>
                                    <div class="product-page-details__infos_start" data-tooltip-key="ProductPage.specification.standardizedPowerReserve.tooltip">
                        <h5 class="product-page-details__infos_subtitle">Power reserve</h5>
                        <div id="tooltip-6928254d78899" class="tooltip tooltip--touch-enabled product-page-details__infos_subtitle__tooltip tooltip--minimal" data-options="{&quot;placement&quot;:&quot;top-start&quot;,&quot;enableArrow&quot;:false,&quot;offset&quot;:5,&quot;enableTouch&quot;:true}">
    <div class="tooltip__trigger" aria-describedby="tooltip-content-tooltip-6928254d78899" tabindex="0">
        <button type="button" class="btn btn--xs btn--default btn--icon-only btn--icon">
            <span class="sr-only">
                Discover more
            </span>

            <span class="btn__icon">
                <svg class="icon icon--info-12 icon--bidirectional icon--12" aria-hidden="true" focusable="false" aria-labelledby="icon-6928254d788b30000" role="img">
                <use href="https://www.jaeger-lecoultre.com/jlc/dist/assets/icons.svg?cacheKey=b81f1f6a799799d00514031b7b625ae3#info-12"></use>
    </svg>
            </span>
        </button>
    </div>

    <div id="tooltip-content-tooltip-6928254d78899" class="tooltip__content" role="tooltip">
        The time the watch will continue to function before rewinding is necessary.
    </div>
</div>

                    </div>

                    <div class="product-page-details__infos_text">
                                                    70 hours                                             </div>
                                    <div class="product-page-details__infos_start" data-tooltip-key="ProductPage.specification.standardizedNumberOfPieces.tooltip">
                        <h5 class="product-page-details__infos_subtitle">Components</h5>
                                            </div>

                    <div class="product-page-details__infos_text">
                                                    351                                             </div>
                                    <div class="product-page-details__infos_start" data-tooltip-key="ProductPage.specification.standardizedNumberOfRubis.tooltip">
                        <h5 class="product-page-details__infos_subtitle">Jewels</h5>
                        <div id="tooltip-6928254d7892f" class="tooltip tooltip--touch-enabled product-page-details__infos_subtitle__tooltip tooltip--minimal" data-options="{&quot;placement&quot;:&quot;top-start&quot;,&quot;enableArrow&quot;:false,&quot;offset&quot;:5,&quot;enableTouch&quot;:true}">
    <div class="tooltip__trigger" aria-describedby="tooltip-content-tooltip-6928254d7892f" tabindex="0">
        <button type="button" class="btn btn--xs btn--default btn--icon-only btn--icon">
            <span class="sr-only">
                Discover more
            </span>

            <span class="btn__icon">
                <svg class="icon icon--info-12 icon--bidirectional icon--12" aria-hidden="true" focusable="false" aria-labelledby="icon-6928254d789540000" role="img">
                <use href="https://www.jaeger-lecoultre.com/jlc/dist/assets/icons.svg?cacheKey=b81f1f6a799799d00514031b7b625ae3#info-12"></use>
    </svg>
            </span>
        </button>
    </div>

    <div id="tooltip-content-tooltip-6928254d7892f" class="tooltip__content" role="tooltip">
        Jewels are used as bearings for pivots to reduce friction in a watch movement.
    </div>
</div>

                    </div>

                    <div class="product-page-details__infos_text">
                                                    54                                             </div>
                                    <div class="product-page-details__infos_start" data-tooltip-key="ProductPage.specification.standardizedNumberOfBarrels.tooltip">
                        <h5 class="product-page-details__infos_subtitle">Barrel</h5>
                                            </div>

                    <div class="product-page-details__infos_text">
                                                    1                                             </div>
                            </div>

                            <div class="btn-grid mb-sm">
                                            <a href="https://www.jaeger-lecoultre.com/au-en/services/customer-care-watches" class="btn btn--default btn--sm btn--full btn--icon btn--centered-with-icon">
                            <span class="btn__text" data-uw-trigger="" data-uw-ignore-s25="" aria-haspopup="dialog">Maintenance advice</span>
                            <span class="btn__icon pointer-events-none">
                                <svg class="icon icon--arrow-16 icon--bidirectional " aria-hidden="true" focusable="false" aria-labelledby="icon-6928254d789a20000" role="img">
                <use href="https://www.jaeger-lecoultre.com/jlc/dist/assets/icons.svg?cacheKey=b81f1f6a799799d00514031b7b625ae3#arrow-16"></use>
    </svg>
                            </span>
                        </a>
                    
                                            <button id="download-manual-button" class="btn btn--default btn--sm btn--full btn--icon btn--centered-with-icon">
                            <span class="btn__text" data-uw-trigger="" data-uw-ignore-s25="" aria-haspopup="dialog">Download the user manual</span>
                            <span class="btn__icon pointer-events-none">
                                <svg class="icon icon--download-16 " aria-hidden="true" focusable="false" aria-labelledby="icon-6928254d791340000" role="img">
                <use href="https://www.jaeger-lecoultre.com/jlc/dist/assets/icons.svg?cacheKey=b81f1f6a799799d00514031b7b625ae3#download-16"></use>
    </svg>
                            </span>
                        </button>
                                    </div>

                
                    </div>
    </li>
    
    
            <li class="menu__item accordion__item">
    <button class="accordion__title menu__entry menu__link menu__toggle accordion__toggle " data-toggle="collapse" data-target="#product-accordion-tab-straps-and-buckles" aria-expanded="false" data-cy="straps-included-accordion-toggle">
        Straps &amp; Buckles
        <svg class="icon icon--chevron-down-10 icon--12" focusable="false" aria-labelledby="icon-6928254d7c4a60000" role="img">
                    <title id="icon-6928254d7c4a60000">Straps &amp; Buckles</title>
                <use href="https://www.jaeger-lecoultre.com/jlc/dist/assets/icons.svg?cacheKey=b81f1f6a799799d00514031b7b625ae3#chevron-down-10"></use>
    </svg>
    </button>

            <div id="product-accordion-tab-straps-and-buckles" class="accordion__content collapse">
            
                <div class="product-page-details__infos-strap-variants mb-base">
                                                                                            <div class="product-page-details__infos-strap-variant" data-cy="straps-included-media-item">
                                <div class="product-page-details__infos_start" data-tooltip-key="ProductPage.specification.strapsIncluded.tooltip">
                                    <h5 class="product-page-details__infos_subtitle">
                                        Mounted on the watch
                                    </h5>
                                                                    </div>

                                                                    <div class="product-card product-card--small-vertical" data-cy="product-card">
    <div class="product-card__picture">
        <div class="picture">
            <picture>
                                    <source srcset="data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width=%22768%22%20height=%22768%22%20viewBox%3D%220%200%20768%20768%22%3E%3C%2Fsvg%3E" data-srcset="https://img.jaeger-lecoultre.com/product-card-md-3/o-dpr-2/7f90a0b5b9507a8a22acb75e3af8afab61a76f52.jpg 2x, https://img.jaeger-lecoultre.com/product-card-md-3/7f90a0b5b9507a8a22acb75e3af8afab61a76f52.jpg 1x" media="(min-width: 768px)">
                            <source srcset="data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width=%22512%22%20height=%22512%22%20viewBox%3D%220%200%20512%20512%22%3E%3C%2Fsvg%3E" data-srcset="https://img.jaeger-lecoultre.com/product-card-sm-3/o-dpr-2/7f90a0b5b9507a8a22acb75e3af8afab61a76f52.jpg 2x, https://img.jaeger-lecoultre.com/product-card-sm-3/7f90a0b5b9507a8a22acb75e3af8afab61a76f52.jpg 1x" media="(min-width: 568px)">
            
            <img src="data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width=%22320%22%20height=%22320%22%20viewBox%3D%220%200%20320%20320%22%3E%3C%2Fsvg%3E" data-src="https://img.jaeger-lecoultre.com/product-card-3/7f90a0b5b9507a8a22acb75e3af8afab61a76f52.jpg" data-srcset="https://img.jaeger-lecoultre.com/product-card-3/o-dpr-2/7f90a0b5b9507a8a22acb75e3af8afab61a76f52.jpg 2x, https://img.jaeger-lecoultre.com/product-card-3/7f90a0b5b9507a8a22acb75e3af8afab61a76f52.jpg 1x" alt="Black" class="lazyload img-block  lazyload--fade ">

            <noscript>
                <img src="https://img.jaeger-lecoultre.com/product-card-3/7f90a0b5b9507a8a22acb75e3af8afab61a76f52.jpg"
                    alt="Black"
                    class="img-block  lazyload--fade "
                >
            </noscript>
            </picture>
        </div>
    </div>

    <div class="product-card__body">
        <a href="https://www.jaeger-lecoultre.com/au-en/straps/alligator-leather/alligator-leather-black-strap-qc21076z" class="product-card__link expand-target">
            <div class="product-card__details">
                
                                    <h5 class="product-card__collection">Alligator Leather</h5>
                
                <h5 class="product-card__name">Black</h5>

                
                            </div>
        </a>
            </div>
</div>
                                                            </div>
                                                    <div class="product-page-details__infos-strap-variant" data-cy="straps-included-media-item">
                                <div class="product-page-details__infos_start" data-tooltip-key="ProductPage.specification.strapsIncluded.tooltip">
                                    <h5 class="product-page-details__infos_subtitle">
                                        Complimentary strap included
                                    </h5>
                                                                    </div>

                                                                    <div class="product-card product-card--small-vertical" data-cy="product-card">
    <div class="product-card__picture">
        <div class="picture">
            <picture>
                                    <source srcset="data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width=%22768%22%20height=%22768%22%20viewBox%3D%220%200%20768%20768%22%3E%3C%2Fsvg%3E" data-srcset="https://img.jaeger-lecoultre.com/product-card-md-3/o-dpr-2/e8f680f80cd61849fffd6aeec414f4bbdb830370.jpg 2x, https://img.jaeger-lecoultre.com/product-card-md-3/e8f680f80cd61849fffd6aeec414f4bbdb830370.jpg 1x" media="(min-width: 768px)">
                            <source srcset="data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width=%22512%22%20height=%22512%22%20viewBox%3D%220%200%20512%20512%22%3E%3C%2Fsvg%3E" data-srcset="https://img.jaeger-lecoultre.com/product-card-sm-3/o-dpr-2/e8f680f80cd61849fffd6aeec414f4bbdb830370.jpg 2x, https://img.jaeger-lecoultre.com/product-card-sm-3/e8f680f80cd61849fffd6aeec414f4bbdb830370.jpg 1x" media="(min-width: 568px)">
            
            <img src="data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width=%22320%22%20height=%22320%22%20viewBox%3D%220%200%20320%20320%22%3E%3C%2Fsvg%3E" data-src="https://img.jaeger-lecoultre.com/product-card-3/e8f680f80cd61849fffd6aeec414f4bbdb830370.jpg" data-srcset="https://img.jaeger-lecoultre.com/product-card-3/o-dpr-2/e8f680f80cd61849fffd6aeec414f4bbdb830370.jpg 2x, https://img.jaeger-lecoultre.com/product-card-3/e8f680f80cd61849fffd6aeec414f4bbdb830370.jpg 1x" alt="Blue" class="lazyload img-block  lazyload--fade ">

            <noscript>
                <img src="https://img.jaeger-lecoultre.com/product-card-3/e8f680f80cd61849fffd6aeec414f4bbdb830370.jpg"
                    alt="Blue"
                    class="img-block  lazyload--fade "
                >
            </noscript>
            </picture>
        </div>
    </div>

    <div class="product-card__body">
        <a href="https://www.jaeger-lecoultre.com/au-en/straps/rubber/rubber-blue-strap-qc46b6si" class="product-card__link expand-target">
            <div class="product-card__details">
                
                                    <h5 class="product-card__collection">Rubber</h5>
                
                <h5 class="product-card__name">Blue</h5>

                
                            </div>
        </a>
            </div>
</div>
                                                            </div>
                                                            </div>

                            
                            <div class="product-page-details__infos_start" data-tooltip-key="ProductPage.specification.strap.tooltip">
                    <h3 class="product-page-details__infos_subtitle">Strap</h3>
                                    </div>

                <div class="product-page-details__infos_text">
                                            Interchangeable: Crafted with quick-release technology for seamless strap interchangeability <br>                                            Standard strand length at 12h: 75mm <br>                                            Length 6h: 115mm <br>                                            Lug width: 21mm                                     </div>
                            <div class="product-page-details__infos_start" data-tooltip-key="ProductPage.specification.buckle.tooltip">
                    <h3 class="product-page-details__infos_subtitle">Buckle</h3>
                                    </div>

                <div class="product-page-details__infos_text">
                                            Folding Buckle <br>                                            Pink Gold 750/1000 (18 carats) <br>                                            Buckle width: 20mm                                     </div>

                
                    </div>
    </li>
    </ul>


                        
                                                    <h2 class="mt-md h5 mb-base">Color and material variants</h2>

    <div class="product-page-details__variants--slider">
        <div id="phx-product-variants" class="slider slider--linear slider--footer-inset slider--faded slider--initialized slider--horizontal slider--free-mode slider--watch-progress slider--backface-hidden slider-faded--end-visible" aria-roledescription="carousel" aria-label="Product variants">
            <div class="slider__body" aria-atomic="false" aria-live="polite" style="transform: translate3d(0px, 0px, 0px);">
                                    <div class="slider__item swiper-slide-visible swiper-slide-fully-visible slider__item--active" aria-roledescription="slide" aria-label="Polaris Perpetual Calendar">
                        <a href="https://www.jaeger-lecoultre.com/au-en/watches/polaris/polaris-perpetual-calendar-pink-gold-q908263j" data-tracking="{&quot;event&quot;:&quot;item_variant&quot;,&quot;variant_id&quot;:&quot;Q908263J&quot;,&quot;items&quot;:[{&quot;item_id&quot;:&quot;Q9082681&quot;,&quot;item_name&quot;:&quot;Perpetual Calendar&quot;,&quot;item_brand&quot;:&quot;jlc&quot;,&quot;item_category&quot;:&quot;Watches&quot;,&quot;item_collection&quot;:&quot;Polaris&quot;,&quot;item_sellable&quot;:&quot;sellable&quot;,&quot;currency&quot;:&quot;AUD&quot;,&quot;price&quot;:&quot;92000.00&quot;,&quot;item_variant&quot;:&quot;&quot;,&quot;item_line&quot;:&quot;&quot;}]}" class="picture picture--actionable picture--full btn btn--default product-page-details__variant" tabindex="0">
                            <div class="picture">
                                <picture>
                                    <source srcset="https://img.jaeger-lecoultre.com/product-thumb-sm-5/o-dpr-2/cc6a2cb2262ebf378525f3d18b2e0da6e675a905.jpg 2x, https://img.jaeger-lecoultre.com/product-thumb-sm-5/cc6a2cb2262ebf378525f3d18b2e0da6e675a905.jpg 1x" data-srcset="https://img.jaeger-lecoultre.com/product-thumb-sm-5/o-dpr-2/cc6a2cb2262ebf378525f3d18b2e0da6e675a905.jpg 2x, https://img.jaeger-lecoultre.com/product-thumb-sm-5/cc6a2cb2262ebf378525f3d18b2e0da6e675a905.jpg 1x" media="(min-width: 568px)">
            
            <img src="https://img.jaeger-lecoultre.com/product-thumb-5/cc6a2cb2262ebf378525f3d18b2e0da6e675a905.jpg" data-src="https://img.jaeger-lecoultre.com/product-thumb-5/cc6a2cb2262ebf378525f3d18b2e0da6e675a905.jpg" data-srcset="https://img.jaeger-lecoultre.com/product-thumb-5/o-dpr-2/cc6a2cb2262ebf378525f3d18b2e0da6e675a905.jpg 2x, https://img.jaeger-lecoultre.com/product-thumb-5/cc6a2cb2262ebf378525f3d18b2e0da6e675a905.jpg 1x" alt="Perpetual Calendar" class=" ls-is-cached lazyloaded" srcset="https://img.jaeger-lecoultre.com/product-thumb-5/o-dpr-2/cc6a2cb2262ebf378525f3d18b2e0da6e675a905.jpg 2x, https://img.jaeger-lecoultre.com/product-thumb-5/cc6a2cb2262ebf378525f3d18b2e0da6e675a905.jpg 1x">

            <noscript>
                <img src="https://img.jaeger-lecoultre.com/product-thumb-5/cc6a2cb2262ebf378525f3d18b2e0da6e675a905.jpg"
                    alt="Perpetual Calendar"
                    class=" "
                >
            </noscript>
            </picture>
                            </div>
                        </a>
                    </div>
                                    <div class="slider__item swiper-slide-visible swiper-slide-fully-visible slider__item--next" aria-roledescription="slide" aria-label="POLARIS PERPETUAL CALENDAR">
                        <a href="https://www.jaeger-lecoultre.com/au-en/watches/polaris/polaris-perpetual-calendar-stainless-steel-q9088180" data-tracking="{&quot;event&quot;:&quot;item_variant&quot;,&quot;variant_id&quot;:&quot;Q9088180&quot;,&quot;items&quot;:[{&quot;item_id&quot;:&quot;Q9082681&quot;,&quot;item_name&quot;:&quot;Perpetual Calendar&quot;,&quot;item_brand&quot;:&quot;jlc&quot;,&quot;item_category&quot;:&quot;Watches&quot;,&quot;item_collection&quot;:&quot;Polaris&quot;,&quot;item_sellable&quot;:&quot;sellable&quot;,&quot;currency&quot;:&quot;AUD&quot;,&quot;price&quot;:&quot;92000.00&quot;,&quot;item_variant&quot;:&quot;&quot;,&quot;item_line&quot;:&quot;&quot;}]}" class="picture picture--actionable picture--full btn btn--default product-page-details__variant" tabindex="0">
                            <div class="picture">
                                <picture>
                                    <source srcset="https://img.jaeger-lecoultre.com/product-thumb-sm-5/o-dpr-2/c1fdc4ee6774392ff4a0dcea235553d0128f4a13.jpg 2x, https://img.jaeger-lecoultre.com/product-thumb-sm-5/c1fdc4ee6774392ff4a0dcea235553d0128f4a13.jpg 1x" data-srcset="https://img.jaeger-lecoultre.com/product-thumb-sm-5/o-dpr-2/c1fdc4ee6774392ff4a0dcea235553d0128f4a13.jpg 2x, https://img.jaeger-lecoultre.com/product-thumb-sm-5/c1fdc4ee6774392ff4a0dcea235553d0128f4a13.jpg 1x" media="(min-width: 568px)">
            
            <img src="https://img.jaeger-lecoultre.com/product-thumb-5/c1fdc4ee6774392ff4a0dcea235553d0128f4a13.jpg" data-src="https://img.jaeger-lecoultre.com/product-thumb-5/c1fdc4ee6774392ff4a0dcea235553d0128f4a13.jpg" data-srcset="https://img.jaeger-lecoultre.com/product-thumb-5/o-dpr-2/c1fdc4ee6774392ff4a0dcea235553d0128f4a13.jpg 2x, https://img.jaeger-lecoultre.com/product-thumb-5/c1fdc4ee6774392ff4a0dcea235553d0128f4a13.jpg 1x" alt="Perpetual Calendar" class=" lazyloaded" srcset="https://img.jaeger-lecoultre.com/product-thumb-5/o-dpr-2/c1fdc4ee6774392ff4a0dcea235553d0128f4a13.jpg 2x, https://img.jaeger-lecoultre.com/product-thumb-5/c1fdc4ee6774392ff4a0dcea235553d0128f4a13.jpg 1x">

            <noscript>
                <img src="https://img.jaeger-lecoultre.com/product-thumb-5/c1fdc4ee6774392ff4a0dcea235553d0128f4a13.jpg"
                    alt="Perpetual Calendar"
                    class=" "
                >
            </noscript>
            </picture>
                            </div>
                        </a>
                    </div>
                            </div>
        </div>
    </div>

                         
                                                    <div class="mt-lg">
                                <div class="reassurance-banner reassurance-banner--column page_speed_165643108">
                                      <button class="reassurance-banner__item" data-modal-open="modal-item-6928254ce846e0000">
    <svg class="icon icon--delivery-24 icon--24" aria-hidden="true" focusable="false" aria-labelledby="icon-6928254d7ceb50000" role="img">
                <use href="https://www.jaeger-lecoultre.com/jlc/dist/assets/icons.svg?cacheKey=b81f1f6a799799d00514031b7b625ae3#delivery-24"></use>
    </svg>

    <div class="h5 reassurance-banner__title">FREE DELIVERY &amp; RETURNS</div>

            <svg class="icon icon--plus-alt-16 icon--16 reassurance-banner--column__icon-end" aria-hidden="true" focusable="false" aria-labelledby="icon-6928254d7cecb0000" role="img">
                <use href="https://www.jaeger-lecoultre.com/jlc/dist/assets/icons.svg?cacheKey=b81f1f6a799799d00514031b7b625ae3#plus-alt-16"></use>
    </svg>
    </button>
                                                                            <button class="reassurance-banner__item" data-modal-open="modal-item-6928254ce85990000">
    <svg class="icon icon--credit-card-24 icon--24" aria-hidden="true" focusable="false" aria-labelledby="icon-6928254d7ceef0000" role="img">
                <use href="https://www.jaeger-lecoultre.com/jlc/dist/assets/icons.svg?cacheKey=b81f1f6a799799d00514031b7b625ae3#credit-card-24"></use>
    </svg>

    <div class="h5 reassurance-banner__title">SECURE PAYMENT</div>

            <svg class="icon icon--plus-alt-16 icon--16 reassurance-banner--column__icon-end" aria-hidden="true" focusable="false" aria-labelledby="icon-6928254d7cefd0000" role="img">
                <use href="https://www.jaeger-lecoultre.com/jlc/dist/assets/icons.svg?cacheKey=b81f1f6a799799d00514031b7b625ae3#plus-alt-16"></use>
    </svg>
    </button>
                                                                            <button class="reassurance-banner__item" data-modal-open="modal-item-6928254ce86a80000">
    <svg class="icon icon--swiss-made-24 icon--24" aria-hidden="true" focusable="false" aria-labelledby="icon-6928254d7cf200000" role="img">
                <use href="https://www.jaeger-lecoultre.com/jlc/dist/assets/icons.svg?cacheKey=b81f1f6a799799d00514031b7b625ae3#swiss-made-24"></use>
    </svg>

    <div class="h5 reassurance-banner__title">SWISS MADE</div>

            <svg class="icon icon--plus-alt-16 icon--16 reassurance-banner--column__icon-end" aria-hidden="true" focusable="false" aria-labelledby="icon-6928254d7cf2e0000" role="img">
                <use href="https://www.jaeger-lecoultre.com/jlc/dist/assets/icons.svg?cacheKey=b81f1f6a799799d00514031b7b625ae3#plus-alt-16"></use>
    </svg>
    </button>
                                                                            <button class="reassurance-banner__item" data-modal-open="modal-item-6928254ce87b10000">
    <svg class="icon icon--care-24 icon--24" aria-hidden="true" focusable="false" aria-labelledby="icon-6928254d7cf490000" role="img">
                <use href="https://www.jaeger-lecoultre.com/jlc/dist/assets/icons.svg?cacheKey=b81f1f6a799799d00514031b7b625ae3#care-24"></use>
    </svg>

    <div class="h5 reassurance-banner__title">UP TO 8 YEARS OF WARRANTY</div>

            <svg class="icon icon--plus-alt-16 icon--16 reassurance-banner--column__icon-end" aria-hidden="true" focusable="false" aria-labelledby="icon-6928254d7cf560000" role="img">
                <use href="https://www.jaeger-lecoultre.com/jlc/dist/assets/icons.svg?cacheKey=b81f1f6a799799d00514031b7b625ae3#plus-alt-16"></use>
    </svg>
    </button>
                                                                            <button class="reassurance-banner__item" data-modal-open="modal-item-6928254ce88b80000">
    <svg class="icon icon--watch-maker-24 icon--24" aria-hidden="true" focusable="false" aria-labelledby="icon-6928254d7cf720000" role="img">
                <use href="https://www.jaeger-lecoultre.com/jlc/dist/assets/icons.svg?cacheKey=b81f1f6a799799d00514031b7b625ae3#watch-maker-24"></use>
    </svg>

    <div class="h5 reassurance-banner__title">AFTER-SALE SERVICES</div>

            <svg class="icon icon--plus-alt-16 icon--16 reassurance-banner--column__icon-end" aria-hidden="true" focusable="false" aria-labelledby="icon-6928254d7cf7f0000" role="img">
                <use href="https://www.jaeger-lecoultre.com/jlc/dist/assets/icons.svg?cacheKey=b81f1f6a799799d00514031b7b625ae3#plus-alt-16"></use>
    </svg>
    </button>
                                                                    </div>
                            </div>
                        
                        
                        
                        
                                                    <h5 class="mt-md mb-sm">Personalise your watch</h5>
                            <div class="duo-button duo-button--stacked duo-button--full">
                                <div class="duo-button__wrapper">
                                                                            <a href="https://www.jaeger-lecoultre.com/au-en/strap-search?reference=Q9082681" class="btn btn--default btn--xs btn--even btn--outlined btn--full btn--icon btn--description-icons-start-end">
                                        <span class="btn__icon btn__icon--start">
                                            <svg class="icon icon--strap-watch-36 icon--36" aria-hidden="true" focusable="false" aria-labelledby="icon-6928254d7cfa70000" role="img">
                <use href="https://www.jaeger-lecoultre.com/jlc/dist/assets/icons.svg?cacheKey=b81f1f6a799799d00514031b7b625ae3#strap-watch-36"></use>
    </svg>
                                        </span>

                                            <span class="btn__text" data-description="Add another compatible strap" data-uw-trigger="" data-uw-ignore-s25="" aria-haspopup="dialog">
                                            Strap finder
                                        </span>

                                            <span class="btn__icon btn__icon--end">
                                            <svg class="icon icon--arrow-16 icon--bidirectional " aria-hidden="true" focusable="false" aria-labelledby="icon-6928254d7cfb50000" role="img">
                <use href="https://www.jaeger-lecoultre.com/jlc/dist/assets/icons.svg?cacheKey=b81f1f6a799799d00514031b7b625ae3#arrow-16"></use>
    </svg>
                                        </span>
                                        </a>
                                                                    </div>
                            </div>
                                            </div>

<div class="product-images-grid__item-container">
                    <button class="picture picture--actionable picture--contain lightbox-trigger" data-lightbox-open="product-light-box-6928254ce614c" data-lightbox-index="0">
                <picture>
                                    <source srcset="https://img.jaeger-lecoultre.com/product-grid-hero-xl-4/o-dpr-2/2a18ba84be2e2573f620f228c3a561d66582518c.jpg 2x, https://img.jaeger-lecoultre.com/product-grid-hero-xl-4/2a18ba84be2e2573f620f228c3a561d66582518c.jpg 1x" media="(min-width: 1280px)">
                            <source srcset="https://img.jaeger-lecoultre.com/product-grid-hero-lg-4/o-dpr-2/2a18ba84be2e2573f620f228c3a561d66582518c.jpg 2x, https://img.jaeger-lecoultre.com/product-grid-hero-lg-4/2a18ba84be2e2573f620f228c3a561d66582518c.jpg 1x" media="(min-width: 1024px)">
            
            <img src="https://img.jaeger-lecoultre.com/product-grid-hero-4/2a18ba84be2e2573f620f228c3a561d66582518c.jpg" alt="Front product image of the watch Q9082681" srcset="https://img.jaeger-lecoultre.com/product-grid-hero-4/o-dpr-2/2a18ba84be2e2573f620f228c3a561d66582518c.jpg 2x, https://img.jaeger-lecoultre.com/product-grid-hero-4/2a18ba84be2e2573f620f228c3a561d66582518c.jpg 1x" class="img-block " data-uw-rm-alt-original="Front product image of the watch Q9082681" data-uw-rm-alt="ALT">
            </picture>
            </button>
        
        <ul class="product-images-grid__item-actions" role="presentation">
        
                    <li role="presentation">
                <div class="phoenix-wishlist-button" data-v-app=""><button class="btn btn--default btn--sm btn--icon-only btn--icon btn-wishlist btn--white" aria-label="Add to wishlist" data-cy="wishlist-button" data-tracking="{&quot;event&quot;:&quot;add_to_wishlist&quot;,&quot;page_type&quot;:&quot;Product&quot;,&quot;wishlist_name&quot;:&quot;wishlist&quot;,&quot;items&quot;:[null]}" collection="Polaris" data-algolia-insights="{&quot;objectIDs&quot;:[&quot;Page::4517&quot;],&quot;index&quot;:&quot;products&quot;,&quot;eventName&quot;:&quot;Product converted&quot;,&quot;type&quot;:&quot;conversion&quot;}"><span class="btn__icon"><svg class="icon icon--heart-20 icon--20" aria-hidden="true" focusable="false" role="img"><!----><use xlink:href="https://www.jaeger-lecoultre.com/jlc/dist/assets/icons.svg?cacheKey=b81f1f6a799799d00514031b7b625ae3#heart-20"></use></svg></span></button></div>

            </li>
            </ul>
    </div>

Duometre
<a href="https://www.jaeger-lecoultre.com/au-en/watches/duometre/duometre-chronograph-moon-pink-gold-q622252j" class="product-card__link" data-tracking="{&quot;event&quot;:&quot;select_item&quot;,&quot;ecommerce&quot;:{&quot;currency&quot;:&quot;AUD&quot;,&quot;items&quot;:[{&quot;item_id&quot;:&quot;Q622252J&quot;,&quot;item_name&quot;:&quot;Chronograph Moon&quot;,&quot;item_brand&quot;:&quot;jlc&quot;,&quot;item_category&quot;:&quot;Watches&quot;,&quot;item_collection&quot;:&quot;Duometre&quot;,&quot;item_sellable&quot;:&quot;notsellable&quot;,&quot;currency&quot;:&quot;&quot;,&quot;price&quot;:&quot;&quot;,&quot;item_variant&quot;:&quot;&quot;,&quot;item_line&quot;:&quot;&quot;}],&quot;_currency&quot;:{&quot;AU&quot;:&quot;AUD&quot;}}}" data-uw-rm-brl="PR" data-uw-original-href="https://www.jaeger-lecoultre.com/au-en/watches/duometre/duometre-chronograph-moon-pink-gold-q622252j"><div class="simple-slider product-card__slider" style="pointer-events: auto;"><div class="simple-slider__body"><div class="simple-slider__slide product-card__picture"><div class="picture"><picture><source media="(min-width: 768px)" srcset="https://img.jaeger-lecoultre.com/product-card-md-3/o-dpr-2/307f01b42096e9e5e39d6823c79a729a194cbc45.jpg 2x, https://img.jaeger-lecoultre.com/product-card-md-3/307f01b42096e9e5e39d6823c79a729a194cbc45.jpg 1x" data-srcset="https://img.jaeger-lecoultre.com/product-card-md-3/o-dpr-2/307f01b42096e9e5e39d6823c79a729a194cbc45.jpg 2x, https://img.jaeger-lecoultre.com/product-card-md-3/307f01b42096e9e5e39d6823c79a729a194cbc45.jpg 1x"><source media="(min-width: 568px)" srcset="https://img.jaeger-lecoultre.com/product-card-sm-3/o-dpr-2/307f01b42096e9e5e39d6823c79a729a194cbc45.jpg 2x, https://img.jaeger-lecoultre.com/product-card-sm-3/307f01b42096e9e5e39d6823c79a729a194cbc45.jpg 1x" data-srcset="https://img.jaeger-lecoultre.com/product-card-sm-3/o-dpr-2/307f01b42096e9e5e39d6823c79a729a194cbc45.jpg 2x, https://img.jaeger-lecoultre.com/product-card-sm-3/307f01b42096e9e5e39d6823c79a729a194cbc45.jpg 1x"><img src="https://img.jaeger-lecoultre.com/product-card-3/307f01b42096e9e5e39d6823c79a729a194cbc45.jpg" data-src="https://img.jaeger-lecoultre.com/product-card-3/307f01b42096e9e5e39d6823c79a729a194cbc45.jpg" data-srcset="https://img.jaeger-lecoultre.com/product-card-3/o-dpr-2/307f01b42096e9e5e39d6823c79a729a194cbc45.jpg 2x, https://img.jaeger-lecoultre.com/product-card-3/307f01b42096e9e5e39d6823c79a729a194cbc45.jpg 1x" class=" lazyloaded" alt="Chronograph Moon" srcset="https://img.jaeger-lecoultre.com/product-card-3/o-dpr-2/307f01b42096e9e5e39d6823c79a729a194cbc45.jpg 2x, https://img.jaeger-lecoultre.com/product-card-3/307f01b42096e9e5e39d6823c79a729a194cbc45.jpg 1x" data-uw-rm-alt-original="Chronograph Moon" data-uw-rm-alt="ALT"></picture></div></div><div class="simple-slider__slide product-card__picture"><div class="picture"><picture><source media="(min-width: 768px)" srcset="https://img.jaeger-lecoultre.com/product-card-md-3/o-dpr-2/b2b89246ab1b866bc97118103c54dc253c7c87ed.jpg 2x, https://img.jaeger-lecoultre.com/product-card-md-3/b2b89246ab1b866bc97118103c54dc253c7c87ed.jpg 1x" data-srcset="https://img.jaeger-lecoultre.com/product-card-md-3/o-dpr-2/b2b89246ab1b866bc97118103c54dc253c7c87ed.jpg 2x, https://img.jaeger-lecoultre.com/product-card-md-3/b2b89246ab1b866bc97118103c54dc253c7c87ed.jpg 1x"><source media="(min-width: 568px)" srcset="https://img.jaeger-lecoultre.com/product-card-sm-3/o-dpr-2/b2b89246ab1b866bc97118103c54dc253c7c87ed.jpg 2x, https://img.jaeger-lecoultre.com/product-card-sm-3/b2b89246ab1b866bc97118103c54dc253c7c87ed.jpg 1x" data-srcset="https://img.jaeger-lecoultre.com/product-card-sm-3/o-dpr-2/b2b89246ab1b866bc97118103c54dc253c7c87ed.jpg 2x, https://img.jaeger-lecoultre.com/product-card-sm-3/b2b89246ab1b866bc97118103c54dc253c7c87ed.jpg 1x"><img src="https://img.jaeger-lecoultre.com/product-card-3/b2b89246ab1b866bc97118103c54dc253c7c87ed.jpg" data-src="https://img.jaeger-lecoultre.com/product-card-3/b2b89246ab1b866bc97118103c54dc253c7c87ed.jpg" data-srcset="https://img.jaeger-lecoultre.com/product-card-3/o-dpr-2/b2b89246ab1b866bc97118103c54dc253c7c87ed.jpg 2x, https://img.jaeger-lecoultre.com/product-card-3/b2b89246ab1b866bc97118103c54dc253c7c87ed.jpg 1x" class=" lazyloaded" alt="Chronograph Moon" srcset="https://img.jaeger-lecoultre.com/product-card-3/o-dpr-2/b2b89246ab1b866bc97118103c54dc253c7c87ed.jpg 2x, https://img.jaeger-lecoultre.com/product-card-3/b2b89246ab1b866bc97118103c54dc253c7c87ed.jpg 1x" data-uw-rm-alt-original="Chronograph Moon" data-uw-rm-alt="ALT"></picture></div></div><div class="simple-slider__slide product-card__picture"><div class="picture"><picture><source media="(min-width: 768px)" srcset="https://img.jaeger-lecoultre.com/product-card-md-3/o-dpr-2/dec09b929398b074744dfa7e10af8b57cbea57b6.jpg 2x, https://img.jaeger-lecoultre.com/product-card-md-3/dec09b929398b074744dfa7e10af8b57cbea57b6.jpg 1x" data-srcset="https://img.jaeger-lecoultre.com/product-card-md-3/o-dpr-2/dec09b929398b074744dfa7e10af8b57cbea57b6.jpg 2x, https://img.jaeger-lecoultre.com/product-card-md-3/dec09b929398b074744dfa7e10af8b57cbea57b6.jpg 1x"><source media="(min-width: 568px)" srcset="https://img.jaeger-lecoultre.com/product-card-sm-3/o-dpr-2/dec09b929398b074744dfa7e10af8b57cbea57b6.jpg 2x, https://img.jaeger-lecoultre.com/product-card-sm-3/dec09b929398b074744dfa7e10af8b57cbea57b6.jpg 1x" data-srcset="https://img.jaeger-lecoultre.com/product-card-sm-3/o-dpr-2/dec09b929398b074744dfa7e10af8b57cbea57b6.jpg 2x, https://img.jaeger-lecoultre.com/product-card-sm-3/dec09b929398b074744dfa7e10af8b57cbea57b6.jpg 1x"><img src="https://img.jaeger-lecoultre.com/product-card-3/dec09b929398b074744dfa7e10af8b57cbea57b6.jpg" data-src="https://img.jaeger-lecoultre.com/product-card-3/dec09b929398b074744dfa7e10af8b57cbea57b6.jpg" data-srcset="https://img.jaeger-lecoultre.com/product-card-3/o-dpr-2/dec09b929398b074744dfa7e10af8b57cbea57b6.jpg 2x, https://img.jaeger-lecoultre.com/product-card-3/dec09b929398b074744dfa7e10af8b57cbea57b6.jpg 1x" class=" lazyloaded" alt="Chronograph Moon" srcset="https://img.jaeger-lecoultre.com/product-card-3/o-dpr-2/dec09b929398b074744dfa7e10af8b57cbea57b6.jpg 2x, https://img.jaeger-lecoultre.com/product-card-3/dec09b929398b074744dfa7e10af8b57cbea57b6.jpg 1x" data-uw-rm-alt-original="Chronograph Moon" data-uw-rm-alt="ALT"></picture></div></div></div><div class="product-card__slider-pagination"><span class="simple-slider__pagination-bullet simple-slider__pagination-bullet--active"></span><span class="simple-slider__pagination-bullet"></span><span class="simple-slider__pagination-bullet"></span></div></div><div class="product-card__body"><div class="product-card__details"><div class="product-card__tags" data-cy="product-tags"><span class="tag product-card__tag">Exclusivity</span></div><h5 class="product-card__collection">Duometre</h5><h5 class="product-card__name">Chronograph Moon</h5><div class="product-card__specs">42.5 mm  Manual Winding Pink Gold Chronograph Moon Phase Watch</div><div class="product-price product-card__price product-price--thin product-price--small"><span>Price available upon request</span></div></div></div></a>

<div class="product-page-details__infos" data-cy="product-page-details-top">
                        <div class="hidden md:block">
                            <div class="product-page-details__tags" data-cy="product-tags">
                    <span class="tag product-page-details__tag">Exclusivity</span>
            </div>

<div class="product-page-details__title-price-wrapper">
    <h1 class="product-page-details__title h3" role="heading" aria-level="2" data-uw-rm-heading="level">
        Duometre<br>
        <span class="product-page-details__subtitle">Chronograph Moon</span>
    </h1>

            <div class="product-price">
            <span class="product-price__value">Price available upon request</span>
        </div>
    </div>


    <div class="product-page-details__resume text--muted">
        <span class="block">42.5 mm  Manual Winding Pink Gold Chronograph Moon Phase Watch</span>

            </div>
                        </div>

                        <div class="btn-grid--xs mb-sm country-reveal-container" data-cy="product-cta-container">
                                                            
                                                                    <a href="tel:+61 2 8663 8028" type="button" class="btn btn--default btn--icon btn--full btn--negative" data-cy="shop-by-phone-btn" data-country-code="AU" data-tracking="{&quot;event&quot;:&quot;call_center&quot;,&quot;button_position&quot;:&quot;product_page&quot;,&quot;button_type&quot;:&quot;buy&quot;,&quot;items&quot;:[{&quot;item_id&quot;:&quot;Q622252J&quot;,&quot;item_name&quot;:&quot;Chronograph Moon&quot;,&quot;item_brand&quot;:&quot;jlc&quot;,&quot;item_category&quot;:&quot;Watches&quot;,&quot;item_collection&quot;:&quot;Duometre&quot;,&quot;item_sellable&quot;:&quot;notsellable&quot;,&quot;currency&quot;:&quot;&quot;,&quot;price&quot;:&quot;&quot;,&quot;item_variant&quot;:&quot;&quot;,&quot;item_line&quot;:&quot;&quot;}]}" data-algolia-insights="{&quot;objectIDs&quot;:[&quot;Page::4015&quot;],&quot;index&quot;:&quot;products&quot;,&quot;eventName&quot;:&quot;Product converted&quot;,&quot;type&quot;:&quot;conversion&quot;}" aria-label="call +61 2 8663 8028" data-uw-rm-vglnk="" uw-rm-vague-link-id="tel:+61 2 8663 8028$call +61 2 8663 8028">
        <span class="btn__text" data-uw-trigger="" data-uw-ignore-s25="" aria-haspopup="dialog">Inquire by phone</span>

                    <span class="btn__icon pointer-events-none">
                <svg class="icon icon--phone-16 " aria-hidden="true" focusable="false" role="img" data-uw-rm-br-ar-ref-lb="" data-uw-rm-sr="" data-uw-rm-br-ar-ref-ids-aria-labelledby="icon-692858f8281010000">
                <use href="https://www.jaeger-lecoultre.com/jlc/dist/assets/icons.svg?cacheKey=b81f1f6a799799d00514031b7b625ae3#phone-16"></use>
    </svg>
            </span>
            </a>
                                
                                                                    <button id="boutique-stock-availability-modal-button" type="button" class="btn btn--default btn--full btn--icon" data-tracking="{&quot;event&quot;:&quot;try_in_boutique&quot;,&quot;items&quot;:[{&quot;item_id&quot;:&quot;Q622252J&quot;,&quot;item_name&quot;:&quot;Chronograph Moon&quot;,&quot;item_brand&quot;:&quot;jlc&quot;,&quot;item_category&quot;:&quot;Watches&quot;,&quot;item_collection&quot;:&quot;Duometre&quot;,&quot;item_sellable&quot;:&quot;notsellable&quot;,&quot;currency&quot;:&quot;&quot;,&quot;price&quot;:&quot;&quot;,&quot;item_variant&quot;:&quot;&quot;,&quot;item_line&quot;:&quot;&quot;}]}" data-modal-open="boutique-stock-availability-modal" data-cy="btn-find-in-boutique" data-algolia-insights="{&quot;objectIDs&quot;:[&quot;Page::4015&quot;],&quot;index&quot;:&quot;products&quot;,&quot;eventName&quot;:&quot;Product converted&quot;,&quot;type&quot;:&quot;conversion&quot;}" aria-label="Availability in boutique" data-uw-rm-empty-ctrl="">
    <span class="btn__text" data-uw-trigger="" data-uw-ignore-s25="" aria-haspopup="dialog">Availability in boutique</span>
    <span class="btn__icon pointer-events-none">
        <svg class="icon icon--pin-16 " aria-hidden="true" focusable="false" role="img" data-uw-rm-br-ar-ref-lb="" data-uw-rm-sr="" data-uw-rm-br-ar-ref-ids-aria-labelledby="icon-692858f8281990000">
                <use href="https://www.jaeger-lecoultre.com/jlc/dist/assets/icons.svg?cacheKey=b81f1f6a799799d00514031b7b625ae3#pin-16"></use>
    </svg>
    </span>
</button>
                                
                                <a href="https://www.jaeger-lecoultre.com/au-en/boutique-appointment?reference=Q622252J" type="button" class="btn btn--default btn--full btn--icon" data-tracking="{&quot;event&quot;:&quot;baa_selected&quot;,&quot;boutique_id&quot;:null}" data-algolia-insights="{&quot;objectIDs&quot;:[&quot;Page::4015&quot;],&quot;index&quot;:&quot;products&quot;,&quot;eventName&quot;:&quot;Product converted&quot;,&quot;type&quot;:&quot;conversion&quot;}" data-uw-rm-brl="PR" data-uw-original-href="https://www.jaeger-lecoultre.com/au-en/boutique-appointment?reference=Q622252J" aria-label="Book an appointment" data-uw-rm-empty-ctrl="">
    <span class="btn__text" data-uw-trigger="" data-uw-ignore-s25="" aria-haspopup="dialog">Book an appointment</span>
    <span class="btn__icon pointer-events-none">
        <svg class="icon icon--clock-16 " aria-hidden="true" focusable="false" role="img" data-uw-rm-br-ar-ref-lb="" data-uw-rm-sr="" data-uw-rm-br-ar-ref-ids-aria-labelledby="icon-692858f8282340000">
                <use href="https://www.jaeger-lecoultre.com/jlc/dist/assets/icons.svg?cacheKey=b81f1f6a799799d00514031b7b625ae3#clock-16"></use>
    </svg>
    </span>
</a>

                                <a href="https://wa.me/+61483905200" target="_blank" type="button" data-tracking="{&quot;event&quot;:&quot;whatsapp&quot;,&quot;items&quot;:[{&quot;item_id&quot;:&quot;Q622252J&quot;,&quot;item_name&quot;:&quot;Chronograph Moon&quot;,&quot;item_brand&quot;:&quot;jlc&quot;,&quot;item_category&quot;:&quot;Watches&quot;,&quot;item_collection&quot;:&quot;Duometre&quot;,&quot;item_sellable&quot;:&quot;notsellable&quot;,&quot;currency&quot;:&quot;&quot;,&quot;price&quot;:&quot;&quot;,&quot;item_variant&quot;:&quot;&quot;,&quot;item_line&quot;:&quot;&quot;}]}" class="btn btn--default btn--full" data-algolia-insights="{&quot;objectIDs&quot;:[&quot;Page::4015&quot;],&quot;index&quot;:&quot;products&quot;,&quot;eventName&quot;:&quot;Product converted&quot;,&quot;type&quot;:&quot;conversion&quot;}" data-uw-rm-brl="PR" data-uw-original-href="https://wa.me/+61483905200" aria-label="WhatsApp - open in a new tab" data-uw-rm-empty-ctrl="" data-uw-rm-ext-link="" uw-rm-external-link-id="https://wa.me/+61483905200$whatsapp">
        <span class="btn__text" data-uw-trigger="" data-uw-ignore-s25="" aria-haspopup="dialog">WhatsApp</span>
        <span class="btn__icon pointer-events-none">
            <svg class="icon icon--whatsapp-16 " aria-hidden="true" focusable="false" role="img" data-uw-rm-br-ar-ref-lb="" data-uw-rm-sr="" data-uw-rm-br-ar-ref-ids-aria-labelledby="icon-692858f8285640000">
                <use href="https://www.jaeger-lecoultre.com/jlc/dist/assets/icons.svg?cacheKey=b81f1f6a799799d00514031b7b625ae3#whatsapp-16"></use>
    </svg>
        </span>
    </a>

                                
                                                                    <span id="show-sticky-add-to-bag"></span>
                                                                                    </div>

                        
                        
                        <ul class="accordion menu menu--border-full-width product-page-details__description-accordion">
    
    <li class="menu__item accordion__item">
    <button class="accordion__title menu__entry menu__link menu__toggle accordion__toggle " data-toggle="collapse" data-target="#product-accordion-tab-description" aria-expanded="false">
        Description
        <svg class="icon icon--chevron-down-10 icon--12" focusable="false" aria-labelledby="icon-692858f82906f0000" role="img">
                    <title id="icon-692858f82906f0000">Description</title>
                <use href="https://www.jaeger-lecoultre.com/jlc/dist/assets/icons.svg?cacheKey=b81f1f6a799799d00514031b7b625ae3#chevron-down-10"></use>
    </svg>
    </button>

            <div id="product-accordion-tab-description" class="accordion__content collapse">
            
                <div class="product-page-details__infos_text">
            The sectorized dial of the Duometre Chronograph Moon is extremely legible in terms of both design and function: moon phase on the chronograph counter, whose monopusher triggers start/stop/reset, day/night indicator on the left-hand hour counter, power reserves on either side of the seconde foudroyante at 6 o’clock. At the heart of this complication watch beats the Calibre 391, distinguished by its independent twin barrels and gear trains: one dedicated to the hour/minute indication, the other to complications. Offering different levels of finishing, Calibre 391 is a watchmaking spectacle to be admired under the sapphire crystal on the back of the timepiece.
        </div>

                
                    </div>
    </li>

    
    <li class="menu__item accordion__item">
    <button class="accordion__title menu__entry menu__link menu__toggle accordion__toggle " data-toggle="collapse" data-target="#product-accordion-tab-feature" aria-expanded="false">
        Features
        <svg class="icon icon--chevron-down-10 icon--12" focusable="false" aria-labelledby="icon-692858f8293d20000" role="img">
                    <title id="icon-692858f8293d20000">Features</title>
                <use href="https://www.jaeger-lecoultre.com/jlc/dist/assets/icons.svg?cacheKey=b81f1f6a799799d00514031b7b625ae3#chevron-down-10"></use>
    </svg>
    </button>

            <div id="product-accordion-tab-feature" class="accordion__content collapse">
            
                <div class="product-page-details__infos_start" data-tooltip-key="ProductPage.specification.case.tooltip">
                <h3 class="product-page-details__infos_subtitle">Case</h3>
                            </div>

            <div class="product-page-details__infos_text">
                                    Pink Gold 750/1000 (18 carats) <br>                                    Diameter: 42,5 mm <br>                                    Thickness: 14.2mm                             </div>
                    <div class="product-page-details__infos_start" data-tooltip-key="ProductPage.specification.waterResistance.tooltip">
                <h3 class="product-page-details__infos_subtitle">Water resistance</h3>
                            </div>

            <div class="product-page-details__infos_text">
                                    5 bar                             </div>
                    <div class="product-page-details__infos_start" data-tooltip-key="ProductPage.specification.dial.tooltip">
                <h3 class="product-page-details__infos_subtitle">Dial</h3>
                            </div>

            <div class="product-page-details__infos_text">
                                    Appliqued numerals, Silvered grey, Opaline                             </div>

                
                    </div>
    </li>


            
        <li class="menu__item accordion__item">
    <button class="accordion__title menu__entry menu__link menu__toggle accordion__toggle " data-toggle="collapse" data-target="#product-accordion-tab-movement" aria-expanded="false">
        Movement
        <svg class="icon icon--chevron-down-10 icon--12" focusable="false" aria-labelledby="icon-692858f82ac1c0000" role="img">
                    <title id="icon-692858f82ac1c0000">Movement</title>
                <use href="https://www.jaeger-lecoultre.com/jlc/dist/assets/icons.svg?cacheKey=b81f1f6a799799d00514031b7b625ae3#chevron-down-10"></use>
    </svg>
    </button>

            <div id="product-accordion-tab-movement" class="accordion__content collapse">
            
                <div class="mb-sm text-center bg-media">
                    <div class="picture">
                        <picture>
                    
            <img src="data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width=%22250%22%20height=%22250%22%20viewBox%3D%220%200%20250%20250%22%3E%3C%2Fsvg%3E" data-src="https://img.jaeger-lecoultre.com/product-specifications-movement-1/11dc18401d902c338e5c62a6f6ae2abae19bbbda.jpg" data-srcset="https://img.jaeger-lecoultre.com/product-specifications-movement-1/o-dpr-2/11dc18401d902c338e5c62a6f6ae2abae19bbbda.jpg 2x, https://img.jaeger-lecoultre.com/product-specifications-movement-1/11dc18401d902c338e5c62a6f6ae2abae19bbbda.jpg 1x" alt="Jaeger-LeCoultre Calibre 391" class="lazyload m-auto " data-uw-rm-alt-original="Jaeger-LeCoultre Calibre 391" data-uw-rm-alt="ALT">

            <noscript>
                <img src="https://img.jaeger-lecoultre.com/product-specifications-movement-1/11dc18401d902c338e5c62a6f6ae2abae19bbbda.jpg"
                    alt="Jaeger-LeCoultre Calibre 391"
                    class="m-auto "
                >
            </noscript>
            </picture>
                    </div>
                </div>
            
            <h3 class="product-page-details__infos_title h5">Jaeger-LeCoultre Calibre 391</h3>
            <div class="product-page-details__infos-side-by-side">
                                    <div class="product-page-details__infos_start" data-tooltip-key="ProductPage.specification.standardizedEnergy.tooltip">
                        <h5 class="product-page-details__infos_subtitle" role="heading" aria-level="4" data-uw-rm-heading="level">MOVEMENT TYPE</h5>
                                            </div>

                    <div class="product-page-details__infos_text">
                                                    Manual winding                                             </div>
                                    <div class="product-page-details__infos_start" data-tooltip-key="ProductPage.specification.functions.tooltip">
                        <h5 class="product-page-details__infos_subtitle">Functions</h5>
                                            </div>

                    <div class="product-page-details__infos_text">
                                                    Moon phase, Seconds, Jumping seconds, Twin Power-Reserve, Chronograph, Hour - Minute, Chronograph's Second, Day/Night indicator                                             </div>
                                    <div class="product-page-details__infos_start" data-tooltip-key="ProductPage.specification.standardizedThickness.tooltip">
                        <h5 class="product-page-details__infos_subtitle">Thickness</h5>
                                            </div>

                    <div class="product-page-details__infos_text">
                                                    8.24mm                                             </div>
                                    <div class="product-page-details__infos_start" data-tooltip-key="ProductPage.specification.standardizedFrequenceVph.tooltip">
                        <h5 class="product-page-details__infos_subtitle">Vibrations per hour</h5>
                        <div id="tooltip-692858f82a345" class="tooltip tooltip--touch-enabled product-page-details__infos_subtitle__tooltip tooltip--minimal" data-options="{&quot;placement&quot;:&quot;top-start&quot;,&quot;enableArrow&quot;:false,&quot;offset&quot;:5,&quot;enableTouch&quot;:true}">
    <div class="tooltip__trigger" aria-describedby="tooltip-content-tooltip-692858f82a345" tabindex="0">
        <button type="button" class="btn btn--xs btn--default btn--icon-only btn--icon">
            <span class="sr-only">
                Discover more
            </span>

            <span class="btn__icon">
                <svg class="icon icon--info-12 icon--bidirectional icon--12" aria-hidden="true" focusable="false" role="img" data-uw-rm-br-ar-ref-lb="" data-uw-rm-sr="" data-uw-rm-br-ar-ref-ids-aria-labelledby="icon-692858f82a37c0000">
                <use href="https://www.jaeger-lecoultre.com/jlc/dist/assets/icons.svg?cacheKey=b81f1f6a799799d00514031b7b625ae3#info-12"></use>
    </svg>
            </span>
        </button>
    </div>

    <div id="tooltip-content-tooltip-692858f82a345" class="tooltip__content" role="tooltip">
        The balance makes a to-and-fro movement at a given frequency (two vibrations). It is measured either in Vibration per Hour (VPH) or Hertz (Hz).
    </div>
</div>

                    </div>

                    <div class="product-page-details__infos_text">
                                                    21600                                             </div>
                                    <div class="product-page-details__infos_start" data-tooltip-key="ProductPage.specification.standardizedFrequenceHz.tooltip">
                        <h5 class="product-page-details__infos_subtitle">Frequency (HZ)</h5>
                        <div id="tooltip-692858f82a426" class="tooltip tooltip--touch-enabled product-page-details__infos_subtitle__tooltip tooltip--minimal" data-options="{&quot;placement&quot;:&quot;top-start&quot;,&quot;enableArrow&quot;:false,&quot;offset&quot;:5,&quot;enableTouch&quot;:true}">
    <div class="tooltip__trigger" aria-describedby="tooltip-content-tooltip-692858f82a426" tabindex="0">
        <button type="button" class="btn btn--xs btn--default btn--icon-only btn--icon">
            <span class="sr-only">
                Discover more
            </span>

            <span class="btn__icon">
                <svg class="icon icon--info-12 icon--bidirectional icon--12" aria-hidden="true" focusable="false" role="img" data-uw-rm-br-ar-ref-lb="" data-uw-rm-sr="" data-uw-rm-br-ar-ref-ids-aria-labelledby="icon-692858f82a4480000">
                <use href="https://www.jaeger-lecoultre.com/jlc/dist/assets/icons.svg?cacheKey=b81f1f6a799799d00514031b7b625ae3#info-12"></use>
    </svg>
            </span>
        </button>
    </div>

    <div id="tooltip-content-tooltip-692858f82a426" class="tooltip__content" role="tooltip">
        The balance makes a to-and-fro movement at a given frequency (two vibrations). It is measured either in Vibration per Hour (VPH) or Hertz (Hz).
    </div>
</div>

                    </div>

                    <div class="product-page-details__infos_text">
                                                    3                                             </div>
                                    <div class="product-page-details__infos_start" data-tooltip-key="ProductPage.specification.standardizedPowerReserve.tooltip">
                        <h5 class="product-page-details__infos_subtitle">Power reserve</h5>
                        <div id="tooltip-692858f82a4b6" class="tooltip tooltip--touch-enabled product-page-details__infos_subtitle__tooltip tooltip--minimal" data-options="{&quot;placement&quot;:&quot;top-start&quot;,&quot;enableArrow&quot;:false,&quot;offset&quot;:5,&quot;enableTouch&quot;:true}">
    <div class="tooltip__trigger" aria-describedby="tooltip-content-tooltip-692858f82a4b6" tabindex="0">
        <button type="button" class="btn btn--xs btn--default btn--icon-only btn--icon">
            <span class="sr-only">
                Discover more
            </span>

            <span class="btn__icon">
                <svg class="icon icon--info-12 icon--bidirectional icon--12" aria-hidden="true" focusable="false" role="img" data-uw-rm-br-ar-ref-lb="" data-uw-rm-sr="" data-uw-rm-br-ar-ref-ids-aria-labelledby="icon-692858f82a4d20000">
                <use href="https://www.jaeger-lecoultre.com/jlc/dist/assets/icons.svg?cacheKey=b81f1f6a799799d00514031b7b625ae3#info-12"></use>
    </svg>
            </span>
        </button>
    </div>

    <div id="tooltip-content-tooltip-692858f82a4b6" class="tooltip__content" role="tooltip">
        The time the watch will continue to function before rewinding is necessary.
    </div>
</div>

                    </div>

                    <div class="product-page-details__infos_text">
                                                    50 hours                                             </div>
                                    <div class="product-page-details__infos_start" data-tooltip-key="ProductPage.specification.standardizedNumberOfPieces.tooltip">
                        <h5 class="product-page-details__infos_subtitle">Components</h5>
                                            </div>

                    <div class="product-page-details__infos_text">
                                                    482                                             </div>
                                    <div class="product-page-details__infos_start" data-tooltip-key="ProductPage.specification.standardizedNumberOfRubis.tooltip">
                        <h5 class="product-page-details__infos_subtitle">Jewels</h5>
                        <div id="tooltip-692858f82a54f" class="tooltip tooltip--touch-enabled product-page-details__infos_subtitle__tooltip tooltip--minimal" data-options="{&quot;placement&quot;:&quot;top-start&quot;,&quot;enableArrow&quot;:false,&quot;offset&quot;:5,&quot;enableTouch&quot;:true}">
    <div class="tooltip__trigger" aria-describedby="tooltip-content-tooltip-692858f82a54f" tabindex="0">
        <button type="button" class="btn btn--xs btn--default btn--icon-only btn--icon">
            <span class="sr-only">
                Discover more
            </span>

            <span class="btn__icon">
                <svg class="icon icon--info-12 icon--bidirectional icon--12" aria-hidden="true" focusable="false" role="img" data-uw-rm-br-ar-ref-lb="" data-uw-rm-sr="" data-uw-rm-br-ar-ref-ids-aria-labelledby="icon-692858f82a5680000">
                <use href="https://www.jaeger-lecoultre.com/jlc/dist/assets/icons.svg?cacheKey=b81f1f6a799799d00514031b7b625ae3#info-12"></use>
    </svg>
            </span>
        </button>
    </div>

    <div id="tooltip-content-tooltip-692858f82a54f" class="tooltip__content" role="tooltip">
        Jewels are used as bearings for pivots to reduce friction in a watch movement.
    </div>
</div>

                    </div>

                    <div class="product-page-details__infos_text">
                                                    47                                             </div>
                                    <div class="product-page-details__infos_start" data-tooltip-key="ProductPage.specification.standardizedNumberOfBarrels.tooltip">
                        <h5 class="product-page-details__infos_subtitle">Barrel</h5>
                                            </div>

                    <div class="product-page-details__infos_text">
                                                    2                                             </div>
                            </div>

                            <div class="btn-grid mb-sm">
                                            <a href="https://www.jaeger-lecoultre.com/au-en/services/customer-care-watches" class="btn btn--default btn--sm btn--full btn--icon btn--centered-with-icon" data-uw-rm-brl="PR" data-uw-original-href="https://www.jaeger-lecoultre.com/au-en/services/customer-care-watches">
                            <span class="btn__text" data-uw-trigger="" data-uw-ignore-s25="" aria-haspopup="dialog">Maintenance advice</span>
                            <span class="btn__icon pointer-events-none">
                                <svg class="icon icon--arrow-16 icon--bidirectional " aria-hidden="true" focusable="false" role="img" data-uw-rm-br-ar-ref-lb="" data-uw-rm-sr="" data-uw-rm-br-ar-ref-ids-aria-labelledby="icon-692858f82a5b30000">
                <use href="https://www.jaeger-lecoultre.com/jlc/dist/assets/icons.svg?cacheKey=b81f1f6a799799d00514031b7b625ae3#arrow-16"></use>
    </svg>
                            </span>
                        </a>
                    
                                            <button id="download-manual-button" class="btn btn--default btn--sm btn--full btn--icon btn--centered-with-icon">
                            <span class="btn__text" data-uw-trigger="" data-uw-ignore-s25="" aria-haspopup="dialog">Download the user manual</span>
                            <span class="btn__icon pointer-events-none">
                                <svg class="icon icon--download-16 " aria-hidden="true" focusable="false" role="img" data-uw-rm-br-ar-ref-lb="" data-uw-rm-sr="" data-uw-rm-br-ar-ref-ids-aria-labelledby="icon-692858f82abe50000">
                <use href="https://www.jaeger-lecoultre.com/jlc/dist/assets/icons.svg?cacheKey=b81f1f6a799799d00514031b7b625ae3#download-16"></use>
    </svg>
                            </span>
                        </button>
                                    </div>

                
                    </div>
    </li>
    
    
            <li class="menu__item accordion__item">
    <button class="accordion__title menu__entry menu__link menu__toggle accordion__toggle " data-toggle="collapse" data-target="#product-accordion-tab-straps-and-buckles" aria-expanded="false" data-cy="straps-included-accordion-toggle">
        Straps &amp; Buckles
        <svg class="icon icon--chevron-down-10 icon--12" focusable="false" aria-labelledby="icon-692858f82ae180000" role="img">
                    <title id="icon-692858f82ae180000">Straps &amp; Buckles</title>
                <use href="https://www.jaeger-lecoultre.com/jlc/dist/assets/icons.svg?cacheKey=b81f1f6a799799d00514031b7b625ae3#chevron-down-10"></use>
    </svg>
    </button>

            <div id="product-accordion-tab-straps-and-buckles" class="accordion__content collapse">
            
                <div class="product-page-details__infos_start" data-tooltip-key="ProductPage.specification.strap.tooltip">
                    <h3 class="product-page-details__infos_subtitle">Strap</h3>
                                    </div>

                <div class="product-page-details__infos_text">
                                            Interchangeable: Crafted with quick-release technology for seamless strap interchangeability <br>                                            Standard strand length at 12h: 75mm <br>                                            Length 6h: 120mm <br>                                            Lug width: 21mm                                     </div>
                            <div class="product-page-details__infos_start" data-tooltip-key="ProductPage.specification.buckle.tooltip">
                    <h3 class="product-page-details__infos_subtitle">Buckle</h3>
                                    </div>

                <div class="product-page-details__infos_text">
                                            Pin buckle <br>                                            Pink Gold 750/1000 (18 carats) <br>                                            Buckle width: 18mm                                     </div>

                
                    </div>
    </li>
    </ul>


                        
                                                    <h2 class="mt-md h5 mb-base">Color and material variants</h2>

    <div class="product-page-details__variants--slider">
        <div id="phx-product-variants" class="slider slider--linear slider--footer-inset slider--faded slider--initialized slider--horizontal slider--free-mode slider--watch-progress slider--backface-hidden slider-faded--end-visible" aria-roledescription="carousel" aria-label="Product variants">
            <div class="slider__body" aria-atomic="false" aria-live="polite" style="transform: translate3d(0px, 0px, 0px);">
                                    <div class="slider__item swiper-slide-visible swiper-slide-fully-visible slider__item--active" aria-roledescription="slide" aria-label="Duometre Chronograph Moon">
                        <a href="https://www.jaeger-lecoultre.com/au-en/watches/duometre/duometre-chronograph-moon-platinum-q622656j" data-tracking="{&quot;event&quot;:&quot;item_variant&quot;,&quot;variant_id&quot;:&quot;Q622656J&quot;,&quot;items&quot;:[{&quot;item_id&quot;:&quot;Q622252J&quot;,&quot;item_name&quot;:&quot;Chronograph Moon&quot;,&quot;item_brand&quot;:&quot;jlc&quot;,&quot;item_category&quot;:&quot;Watches&quot;,&quot;item_collection&quot;:&quot;Duometre&quot;,&quot;item_sellable&quot;:&quot;notsellable&quot;,&quot;currency&quot;:&quot;&quot;,&quot;price&quot;:&quot;&quot;,&quot;item_variant&quot;:&quot;&quot;,&quot;item_line&quot;:&quot;&quot;}]}" class="picture picture--actionable picture--full btn btn--default product-page-details__variant" tabindex="0" data-uw-rm-brl="PR" data-uw-original-href="https://www.jaeger-lecoultre.com/au-en/watches/duometre/duometre-chronograph-moon-platinum-q622656j">
                            <div class="picture">
                                <picture>
                                    <source srcset="https://img.jaeger-lecoultre.com/product-thumb-sm-5/o-dpr-2/761633d345db1a78a6ca2a597ef4dd6a78d723ff.jpg 2x, https://img.jaeger-lecoultre.com/product-thumb-sm-5/761633d345db1a78a6ca2a597ef4dd6a78d723ff.jpg 1x" data-srcset="https://img.jaeger-lecoultre.com/product-thumb-sm-5/o-dpr-2/761633d345db1a78a6ca2a597ef4dd6a78d723ff.jpg 2x, https://img.jaeger-lecoultre.com/product-thumb-sm-5/761633d345db1a78a6ca2a597ef4dd6a78d723ff.jpg 1x" media="(min-width: 568px)">
            
            <img src="https://img.jaeger-lecoultre.com/product-thumb-5/761633d345db1a78a6ca2a597ef4dd6a78d723ff.jpg" data-src="https://img.jaeger-lecoultre.com/product-thumb-5/761633d345db1a78a6ca2a597ef4dd6a78d723ff.jpg" data-srcset="https://img.jaeger-lecoultre.com/product-thumb-5/o-dpr-2/761633d345db1a78a6ca2a597ef4dd6a78d723ff.jpg 2x, https://img.jaeger-lecoultre.com/product-thumb-5/761633d345db1a78a6ca2a597ef4dd6a78d723ff.jpg 1x" alt="Chronograph Moon" class=" lazyloaded" srcset="https://img.jaeger-lecoultre.com/product-thumb-5/o-dpr-2/761633d345db1a78a6ca2a597ef4dd6a78d723ff.jpg 2x, https://img.jaeger-lecoultre.com/product-thumb-5/761633d345db1a78a6ca2a597ef4dd6a78d723ff.jpg 1x" data-uw-rm-alt-original="Chronograph Moon" data-uw-rm-alt="ALT">

            <noscript>
                <img src="https://img.jaeger-lecoultre.com/product-thumb-5/761633d345db1a78a6ca2a597ef4dd6a78d723ff.jpg"
                    alt="Chronograph Moon"
                    class=" "
                >
            </noscript>
            </picture>
                            </div>
                        </a>
                    </div>
                            </div>
        </div>
    </div>

                         
                                                    <div class="mt-lg">
                                <div class="reassurance-banner reassurance-banner--column page_speed_135124840">
                                      <button class="reassurance-banner__item" data-modal-open="modal-item-692858f7b748e0000" aria-label="FREE DELIVERY &amp; RETURNS" data-uw-rm-empty-ctrl="">
    <svg class="icon icon--delivery-24 icon--24" aria-hidden="true" focusable="false" role="img" data-uw-rm-br-ar-ref-lb="" data-uw-rm-sr="" data-uw-rm-br-ar-ref-ids-aria-labelledby="icon-692858f82b6d20000">
                <use href="https://www.jaeger-lecoultre.com/jlc/dist/assets/icons.svg?cacheKey=b81f1f6a799799d00514031b7b625ae3#delivery-24"></use>
    </svg>

    <div class="h5 reassurance-banner__title">FREE DELIVERY &amp; RETURNS</div>

            <svg class="icon icon--plus-alt-16 icon--16 reassurance-banner--column__icon-end" aria-hidden="true" focusable="false" role="img" data-uw-rm-br-ar-ref-lb="" data-uw-rm-sr="" data-uw-rm-br-ar-ref-ids-aria-labelledby="icon-692858f82b6e60000">
                <use href="https://www.jaeger-lecoultre.com/jlc/dist/assets/icons.svg?cacheKey=b81f1f6a799799d00514031b7b625ae3#plus-alt-16"></use>
    </svg>
    </button>
                                                                            <button class="reassurance-banner__item" data-modal-open="modal-item-692858f7b75bf0000" aria-label="SECURE PAYMENT" data-uw-rm-empty-ctrl="">
    <svg class="icon icon--credit-card-24 icon--24" aria-hidden="true" focusable="false" role="img" data-uw-rm-br-ar-ref-lb="" data-uw-rm-sr="" data-uw-rm-br-ar-ref-ids-aria-labelledby="icon-692858f82b7080000">
                <use href="https://www.jaeger-lecoultre.com/jlc/dist/assets/icons.svg?cacheKey=b81f1f6a799799d00514031b7b625ae3#credit-card-24"></use>
    </svg>

    <div class="h5 reassurance-banner__title">SECURE PAYMENT</div>

            <svg class="icon icon--plus-alt-16 icon--16 reassurance-banner--column__icon-end" aria-hidden="true" focusable="false" role="img" data-uw-rm-br-ar-ref-lb="" data-uw-rm-sr="" data-uw-rm-br-ar-ref-ids-aria-labelledby="icon-692858f82b7160000">
                <use href="https://www.jaeger-lecoultre.com/jlc/dist/assets/icons.svg?cacheKey=b81f1f6a799799d00514031b7b625ae3#plus-alt-16"></use>
    </svg>
    </button>
                                                                            <button class="reassurance-banner__item" data-modal-open="modal-item-692858f7b76d00000" aria-label="SWISS MADE" data-uw-rm-empty-ctrl="">
    <svg class="icon icon--swiss-made-24 icon--24" aria-hidden="true" focusable="false" role="img" data-uw-rm-br-ar-ref-lb="" data-uw-rm-sr="" data-uw-rm-br-ar-ref-ids-aria-labelledby="icon-692858f82b7370000">
                <use href="https://www.jaeger-lecoultre.com/jlc/dist/assets/icons.svg?cacheKey=b81f1f6a799799d00514031b7b625ae3#swiss-made-24"></use>
    </svg>

    <div class="h5 reassurance-banner__title">SWISS MADE</div>

            <svg class="icon icon--plus-alt-16 icon--16 reassurance-banner--column__icon-end" aria-hidden="true" focusable="false" role="img" data-uw-rm-br-ar-ref-lb="" data-uw-rm-sr="" data-uw-rm-br-ar-ref-ids-aria-labelledby="icon-692858f82b7430000">
                <use href="https://www.jaeger-lecoultre.com/jlc/dist/assets/icons.svg?cacheKey=b81f1f6a799799d00514031b7b625ae3#plus-alt-16"></use>
    </svg>
    </button>
                                                                            <button class="reassurance-banner__item" data-modal-open="modal-item-692858f7b77db0000" aria-label="UP TO 8 YEARS OF WARRANTY" data-uw-rm-empty-ctrl="">
    <svg class="icon icon--care-24 icon--24" aria-hidden="true" focusable="false" role="img" data-uw-rm-br-ar-ref-lb="" data-uw-rm-sr="" data-uw-rm-br-ar-ref-ids-aria-labelledby="icon-692858f82b75e0000">
                <use href="https://www.jaeger-lecoultre.com/jlc/dist/assets/icons.svg?cacheKey=b81f1f6a799799d00514031b7b625ae3#care-24"></use>
    </svg>

    <div class="h5 reassurance-banner__title">UP TO 8 YEARS OF WARRANTY</div>

            <svg class="icon icon--plus-alt-16 icon--16 reassurance-banner--column__icon-end" aria-hidden="true" focusable="false" role="img" data-uw-rm-br-ar-ref-lb="" data-uw-rm-sr="" data-uw-rm-br-ar-ref-ids-aria-labelledby="icon-692858f82b76b0000">
                <use href="https://www.jaeger-lecoultre.com/jlc/dist/assets/icons.svg?cacheKey=b81f1f6a799799d00514031b7b625ae3#plus-alt-16"></use>
    </svg>
    </button>
                                                                            <button class="reassurance-banner__item" data-modal-open="modal-item-692858f7b78df0000" aria-label="AFTER-SALE SERVICES" data-uw-rm-empty-ctrl="">
    <svg class="icon icon--watch-maker-24 icon--24" aria-hidden="true" focusable="false" role="img" data-uw-rm-br-ar-ref-lb="" data-uw-rm-sr="" data-uw-rm-br-ar-ref-ids-aria-labelledby="icon-692858f82b7860000">
                <use href="https://www.jaeger-lecoultre.com/jlc/dist/assets/icons.svg?cacheKey=b81f1f6a799799d00514031b7b625ae3#watch-maker-24"></use>
    </svg>

    <div class="h5 reassurance-banner__title">AFTER-SALE SERVICES</div>

            <svg class="icon icon--plus-alt-16 icon--16 reassurance-banner--column__icon-end" aria-hidden="true" focusable="false" role="img" data-uw-rm-br-ar-ref-lb="" data-uw-rm-sr="" data-uw-rm-br-ar-ref-ids-aria-labelledby="icon-692858f82b7920000">
                <use href="https://www.jaeger-lecoultre.com/jlc/dist/assets/icons.svg?cacheKey=b81f1f6a799799d00514031b7b625ae3#plus-alt-16"></use>
    </svg>
    </button>
                                                                    </div>
                            </div>
                        
                        
                        
                        
                                                    <h5 class="mt-md mb-sm" role="heading" aria-level="3" data-uw-rm-heading="level">Personalise your watch</h5>
                            <div class="duo-button duo-button--stacked duo-button--full">
                                <div class="duo-button__wrapper">
                                                                            <a href="https://www.jaeger-lecoultre.com/au-en/strap-search?reference=Q622252J" class="btn btn--default btn--xs btn--even btn--outlined btn--full btn--icon btn--description-icons-start-end" data-uw-rm-brl="PR" data-uw-original-href="https://www.jaeger-lecoultre.com/au-en/strap-search?reference=Q622252J" aria-label="search" data-uw-rm-empty-ctrl="">
                                        <span class="btn__icon btn__icon--start">
                                            <svg class="icon icon--strap-watch-36 icon--36" aria-hidden="true" focusable="false" role="img" data-uw-rm-br-ar-ref-lb="" data-uw-rm-sr="" data-uw-rm-br-ar-ref-ids-aria-labelledby="icon-692858f82b7b70000">
                <use href="https://www.jaeger-lecoultre.com/jlc/dist/assets/icons.svg?cacheKey=b81f1f6a799799d00514031b7b625ae3#strap-watch-36"></use>
    </svg>
                                        </span>

                                            <span class="btn__text" data-description="Add another compatible strap" data-uw-trigger="" data-uw-ignore-s25="" aria-haspopup="dialog">
                                            Strap finder
                                        </span>

                                            <span class="btn__icon btn__icon--end">
                                            <svg class="icon icon--arrow-16 icon--bidirectional " aria-hidden="true" focusable="false" role="img" data-uw-rm-br-ar-ref-lb="" data-uw-rm-sr="" data-uw-rm-br-ar-ref-ids-aria-labelledby="icon-692858f82b7c90000">
                <use href="https://www.jaeger-lecoultre.com/jlc/dist/assets/icons.svg?cacheKey=b81f1f6a799799d00514031b7b625ae3#arrow-16"></use>
    </svg>
                                        </span>
                                        </a>
                                                                    </div>
                            </div>
                                            </div>

<div class="product-images-grid__item-container">
                    <button class="picture picture--actionable picture--contain lightbox-trigger" data-lightbox-open="product-light-box-692858f7b41ab" data-lightbox-index="1">
                <figure class="figure " role="figure" data-uw-rm-br-ar-ref-lb="" data-uw-rm-sr="" data-uw-rm-br-ar-ref-ids-aria-labelledby="figure-caption-692858f826c600.29028442">
    <picture>
                                    <source srcset="https://img.jaeger-lecoultre.com/product-grid-hero-xl-4/o-dpr-2/307f01b42096e9e5e39d6823c79a729a194cbc45.jpg 2x, https://img.jaeger-lecoultre.com/product-grid-hero-xl-4/307f01b42096e9e5e39d6823c79a729a194cbc45.jpg 1x" media="(min-width: 1280px)">
                            <source srcset="https://img.jaeger-lecoultre.com/product-grid-hero-lg-4/o-dpr-2/307f01b42096e9e5e39d6823c79a729a194cbc45.jpg 2x, https://img.jaeger-lecoultre.com/product-grid-hero-lg-4/307f01b42096e9e5e39d6823c79a729a194cbc45.jpg 1x" media="(min-width: 1024px)">
specs, prices
images
            <img src="https://img.jaeger-lecoultre.com/product-grid-hero-4/307f01b42096e9e5e39d6823c79a729a194cbc45.jpg" alt="Front product image of the watch Q622252J" srcset="https://img.jaeger-lecoultre.com/product-grid-hero-4/o-dpr-2/307f01b42096e9e5e39d6823c79a729a194cbc45.jpg 2x, https://img.jaeger-lecoultre.com/product-grid-hero-4/307f01b42096e9e5e39d6823c79a729a194cbc45.jpg 1x" class="img-block " data-uw-rm-alt-original="Front product image of the watch Q622252J" data-uw-rm-alt="ALT">
            </picture>

    </figure>
            </button>
        
            </div>
