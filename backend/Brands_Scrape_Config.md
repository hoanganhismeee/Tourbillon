# Audemars Piguet Configuration Template

**Status:** Pending HTML element inspection
**Holy Trinity Brand:** Yes (Brand ID: 3)
**Target:** 35 watches across 3 collections (refer to Scraping_guide.md)
Collections names can be find in collections.csv, brands id in brands.csv
Make sure to name the product right: Reference number (exclude Ref. character), just like how we did with the first 2 brands, for the specs, just the watch and calibre is fine, exclude the rest
each brands watch description may be different length and that is all right, just get all the description, just need to follow the structure
---

## Website URLs

**Brand Website:**
```
https://www.jaeger-lecoultre.com/au-en
https://www.alange-soehne.com/au-en
```

**Collection URLs:**
```
https://www.jaeger-lecoultre.com/au-en/watches/reverso

https://www.alange-soehne.com/au-en/timepieces/zeitwerk/zeitwerk-date
```

---

## HTML Selectors (Product Card)
jlc
<div class="product-card" data-cy="mixed-grid-item" category="watches" collection="Reverso Tribute" sellable="false" searchimg="[object Object]" _objectid="Page::3586" _queryid="fd8e6fe7f87354d355512df85dbcbb43" itemid="Q389257J" data-cy-item="product"><a href="/au-en/watches/reverso/reverso-tribute/reverso-tribute-chronograph-q389257j?algoliaQueryID=fd8e6fe7f87354d355512df85dbcbb43" class="product-card__link" data-tracking="{&quot;event&quot;:&quot;select_item&quot;,&quot;ecommerce&quot;:{&quot;currency&quot;:&quot;AUD&quot;,&quot;items&quot;:[{&quot;currency&quot;:&quot;AUD&quot;,&quot;item_brand&quot;:&quot;jlc&quot;,&quot;item_category&quot;:&quot;watches&quot;,&quot;item_collection&quot;:&quot;Reverso Tribute&quot;,&quot;item_id&quot;:&quot;Q389257J&quot;,&quot;item_line&quot;:&quot;&quot;,&quot;item_name&quot;:&quot;Chronograph&quot;,&quot;item_sellable&quot;:false,&quot;item_variant&quot;:&quot;&quot;,&quot;price&quot;:68000}],&quot;_currency&quot;:{&quot;AU&quot;:&quot;AUD&quot;}}}" data-uw-rm-brl="PR" data-uw-original-href="/au-en/watches/reverso/reverso-tribute/reverso-tribute-chronograph-q389257j?algoliaQueryID=fd8e6fe7f87354d355512df85dbcbb43"><div class="simple-slider product-card__slider" style="pointer-events: auto;"><div class="simple-slider__body"><div class="simple-slider__slide product-card__picture"><div class="picture"><picture><source media="(min-width: 768px)" srcset="https://img.jaeger-lecoultre.com/product-card-md-3/o-dpr-2/2b393be0e6d09f16055dd6d8300de47448c2d03b.jpg 2x, https://img.jaeger-lecoultre.com/product-card-md-3/2b393be0e6d09f16055dd6d8300de47448c2d03b.jpg 1x" data-srcset="https://img.jaeger-lecoultre.com/product-card-md-3/o-dpr-2/2b393be0e6d09f16055dd6d8300de47448c2d03b.jpg 2x, https://img.jaeger-lecoultre.com/product-card-md-3/2b393be0e6d09f16055dd6d8300de47448c2d03b.jpg 1x"><source media="(min-width: 568px)" srcset="https://img.jaeger-lecoultre.com/product-card-sm-3/o-dpr-2/2b393be0e6d09f16055dd6d8300de47448c2d03b.jpg 2x, https://img.jaeger-lecoultre.com/product-card-sm-3/2b393be0e6d09f16055dd6d8300de47448c2d03b.jpg 1x" data-srcset="https://img.jaeger-lecoultre.com/product-card-sm-3/o-dpr-2/2b393be0e6d09f16055dd6d8300de47448c2d03b.jpg 2x, https://img.jaeger-lecoultre.com/product-card-sm-3/2b393be0e6d09f16055dd6d8300de47448c2d03b.jpg 1x"><img src="https://img.jaeger-lecoultre.com/product-card-3/2b393be0e6d09f16055dd6d8300de47448c2d03b.jpg" data-src="https://img.jaeger-lecoultre.com/product-card-3/2b393be0e6d09f16055dd6d8300de47448c2d03b.jpg" data-srcset="https://img.jaeger-lecoultre.com/product-card-3/o-dpr-2/2b393be0e6d09f16055dd6d8300de47448c2d03b.jpg 2x, https://img.jaeger-lecoultre.com/product-card-3/2b393be0e6d09f16055dd6d8300de47448c2d03b.jpg 1x" class=" lazyloaded" alt="A stylish rectangular watch with a black dial, gold accents, and a black leather strap. Elegant and sophisticated design." srcset="https://img.jaeger-lecoultre.com/product-card-3/o-dpr-2/2b393be0e6d09f16055dd6d8300de47448c2d03b.jpg 2x, https://img.jaeger-lecoultre.com/product-card-3/2b393be0e6d09f16055dd6d8300de47448c2d03b.jpg 1x" data-uw-rm-alt-original="" data-uw-rm-alt="BE"></picture></div></div><div class="simple-slider__slide product-card__picture"><div class="picture"><picture><source media="(min-width: 768px)" srcset="https://img.jaeger-lecoultre.com/product-card-md-3/o-dpr-2/28e96acde68963914c52ee5285c544fc8e7d6b9e.jpg 2x, https://img.jaeger-lecoultre.com/product-card-md-3/28e96acde68963914c52ee5285c544fc8e7d6b9e.jpg 1x" data-srcset="https://img.jaeger-lecoultre.com/product-card-md-3/o-dpr-2/28e96acde68963914c52ee5285c544fc8e7d6b9e.jpg 2x, https://img.jaeger-lecoultre.com/product-card-md-3/28e96acde68963914c52ee5285c544fc8e7d6b9e.jpg 1x"><source media="(min-width: 568px)" srcset="https://img.jaeger-lecoultre.com/product-card-sm-3/o-dpr-2/28e96acde68963914c52ee5285c544fc8e7d6b9e.jpg 2x, https://img.jaeger-lecoultre.com/product-card-sm-3/28e96acde68963914c52ee5285c544fc8e7d6b9e.jpg 1x" data-srcset="https://img.jaeger-lecoultre.com/product-card-sm-3/o-dpr-2/28e96acde68963914c52ee5285c544fc8e7d6b9e.jpg 2x, https://img.jaeger-lecoultre.com/product-card-sm-3/28e96acde68963914c52ee5285c544fc8e7d6b9e.jpg 1x"><img src="https://img.jaeger-lecoultre.com/product-card-3/28e96acde68963914c52ee5285c544fc8e7d6b9e.jpg" data-src="https://img.jaeger-lecoultre.com/product-card-3/28e96acde68963914c52ee5285c544fc8e7d6b9e.jpg" data-srcset="https://img.jaeger-lecoultre.com/product-card-3/o-dpr-2/28e96acde68963914c52ee5285c544fc8e7d6b9e.jpg 2x, https://img.jaeger-lecoultre.com/product-card-3/28e96acde68963914c52ee5285c544fc8e7d6b9e.jpg 1x" class=" lazyloaded" alt="A luxury watch with a rectangular rose gold case, intricate skeleton dial, and a black leather strap." srcset="https://img.jaeger-lecoultre.com/product-card-3/o-dpr-2/28e96acde68963914c52ee5285c544fc8e7d6b9e.jpg 2x, https://img.jaeger-lecoultre.com/product-card-3/28e96acde68963914c52ee5285c544fc8e7d6b9e.jpg 1x" data-uw-rm-alt-original="" data-uw-rm-alt="BE"></picture></div></div><div class="simple-slider__slide product-card__picture"><div class="picture"><picture><source media="(min-width: 768px)" srcset="https://img.jaeger-lecoultre.com/product-card-md-3/o-dpr-2/ec4768efa6e0141a571f7a5d0cdf2df6131317d3.jpg 2x, https://img.jaeger-lecoultre.com/product-card-md-3/ec4768efa6e0141a571f7a5d0cdf2df6131317d3.jpg 1x" data-srcset="https://img.jaeger-lecoultre.com/product-card-md-3/o-dpr-2/ec4768efa6e0141a571f7a5d0cdf2df6131317d3.jpg 2x, https://img.jaeger-lecoultre.com/product-card-md-3/ec4768efa6e0141a571f7a5d0cdf2df6131317d3.jpg 1x"><source media="(min-width: 568px)" srcset="https://img.jaeger-lecoultre.com/product-card-sm-3/o-dpr-2/ec4768efa6e0141a571f7a5d0cdf2df6131317d3.jpg 2x, https://img.jaeger-lecoultre.com/product-card-sm-3/ec4768efa6e0141a571f7a5d0cdf2df6131317d3.jpg 1x" data-srcset="https://img.jaeger-lecoultre.com/product-card-sm-3/o-dpr-2/ec4768efa6e0141a571f7a5d0cdf2df6131317d3.jpg 2x, https://img.jaeger-lecoultre.com/product-card-sm-3/ec4768efa6e0141a571f7a5d0cdf2df6131317d3.jpg 1x"><img src="https://img.jaeger-lecoultre.com/product-card-3/ec4768efa6e0141a571f7a5d0cdf2df6131317d3.jpg" data-src="https://img.jaeger-lecoultre.com/product-card-3/ec4768efa6e0141a571f7a5d0cdf2df6131317d3.jpg" data-srcset="https://img.jaeger-lecoultre.com/product-card-3/o-dpr-2/ec4768efa6e0141a571f7a5d0cdf2df6131317d3.jpg 2x, https://img.jaeger-lecoultre.com/product-card-3/ec4768efa6e0141a571f7a5d0cdf2df6131317d3.jpg 1x" class=" lazyloaded" alt="A stylish rectangular watch with a black dial, gold-tone case, and black leather strap. Features include hour markers and two side buttons." srcset="https://img.jaeger-lecoultre.com/product-card-3/o-dpr-2/ec4768efa6e0141a571f7a5d0cdf2df6131317d3.jpg 2x, https://img.jaeger-lecoultre.com/product-card-3/ec4768efa6e0141a571f7a5d0cdf2df6131317d3.jpg 1x" data-uw-rm-alt-original="" data-uw-rm-alt="BE"></picture></div></div></div><div class="product-card__slider-pagination"><span class="simple-slider__pagination-bullet simple-slider__pagination-bullet--active"></span><span class="simple-slider__pagination-bullet"></span><span class="simple-slider__pagination-bullet"></span></div></div><div class="product-card__body"><div class="product-card__details"><div class="product-card__tags" data-cy="product-tags"><span class="tag product-card__tag">Exclusivity</span></div><h5 class="product-card__collection" role="heading" aria-level="4" data-uw-rm-heading="level">Reverso Tribute</h5><h5 class="product-card__name">Chronograph</h5><div class="product-card__specs">49.4 x 29.9 mm Manual Pink Gold Chronograph Watch</div><div class="product-price product-card__price product-price--thin product-price--small"><span currencycode="AUD"><span data-price="currency" class="" data-cy="price-currency">AU$</span> <span data-price="value">68,000</span></span></div></div></div></a><div class="product-card__actions"><button class="btn--default btn--xs btn--icon-only btn--icon btn--transparent" aria-label="Add to wishlist" data-cy="wishlist-button" data-tracking="{&quot;event&quot;:&quot;add_to_wishlist&quot;,&quot;page_type&quot;:&quot;Collections&quot;,&quot;wishlist_name&quot;:&quot;wishlist&quot;,&quot;items&quot;:[null]}"><span class="btn__icon"><svg class="icon icon--heart-16" aria-hidden="true" focusable="false" role="img"><!----><use xlink:href="https://www.jaeger-lecoultre.com/jlc/dist/assets/icons.svg?cacheKey=b81f1f6a799799d00514031b7b625ae3#heart-16"></use></svg></span></button></div><div class="product-card__slider-nav-wrapper"><button type="button" class="btn btn--default btn--icon-only btn--icon btn btn--default product-card__slider-nav product-card__slider-nav--prev" aria-label="Get previous item" data-uw-rm-empty-ctrl=""><span class="sr-only">Discover more</span><span class="btn__icon"><svg class="icon icon--chevron-left-10 icon--bidirectional icon--10" aria-hidden="true" focusable="false" role="img"><!----><use xlink:href="https://www.jaeger-lecoultre.com/jlc/dist/assets/icons.svg?cacheKey=b81f1f6a799799d00514031b7b625ae3#chevron-left-10"></use></svg></span></button><button type="button" class="btn btn--default btn--icon-only btn--icon btn btn--default product-card__slider-nav product-card__slider-nav--next" aria-label="Get next item" data-uw-rm-empty-ctrl=""><span class="sr-only">Discover more</span><span class="btn__icon"><svg class="icon icon--chevron-10 icon--bidirectional icon--10" aria-hidden="true" focusable="false" role="img"><!----><use xlink:href="https://www.jaeger-lecoultre.com/jlc/dist/assets/icons.svg?cacheKey=b81f1f6a799799d00514031b7b625ae3#chevron-10"></use></svg></span></button></div></div>


als
<div class="product-card" collection="ZEITWERK DATE" subtitle="in 750 pink gold" product_property_ids="2,18,73,77,243,361,368,382,385,387,395,412,414,429,431,599,600,604,660,661,662,717,718,719,754,772,773,774,775,1093,816,817,821,854,855,893,901,1034,1035,1036,1037,1038,1094,collection-111,type-watches" should_display_prices="false" publication_date="2025-07-25 00:00:00" price_position="1" price_position_desc="2" itemid="mixed-grid-product-LS1484AA" diameter="44.2 mm" imageproductkey="[object Object]" imagesinglepush="[object Object]" referencetext="Reference &lt;span dir=&quot;ltr&quot;&gt;148.033&lt;/span&gt;" template="product" data-cy="mixed-grid-item" data-cy-item="product"><div class="picture product-card__picture picture--contain"><picture><source media="(min-width: 1280px)" srcset="https://img.alange-soehne.com/product-tile-xl-5/o-dpr-2/c4e8781028665c79b7cdeb252d79620d76d8ea27.jpg 2x, https://img.alange-soehne.com/product-tile-xl-5/c4e8781028665c79b7cdeb252d79620d76d8ea27.jpg 1x" data-srcset="https://img.alange-soehne.com/product-tile-xl-5/o-dpr-2/c4e8781028665c79b7cdeb252d79620d76d8ea27.jpg 2x, https://img.alange-soehne.com/product-tile-xl-5/c4e8781028665c79b7cdeb252d79620d76d8ea27.jpg 1x"><source media="(min-width: 1024px)" srcset="https://img.alange-soehne.com/product-tile-lg-5/o-dpr-2/c4e8781028665c79b7cdeb252d79620d76d8ea27.jpg 2x, https://img.alange-soehne.com/product-tile-lg-5/c4e8781028665c79b7cdeb252d79620d76d8ea27.jpg 1x" data-srcset="https://img.alange-soehne.com/product-tile-lg-5/o-dpr-2/c4e8781028665c79b7cdeb252d79620d76d8ea27.jpg 2x, https://img.alange-soehne.com/product-tile-lg-5/c4e8781028665c79b7cdeb252d79620d76d8ea27.jpg 1x"><source media="(min-width: 768px)" srcset="https://img.alange-soehne.com/product-tile-md-5/o-dpr-2/c4e8781028665c79b7cdeb252d79620d76d8ea27.jpg 2x, https://img.alange-soehne.com/product-tile-md-5/c4e8781028665c79b7cdeb252d79620d76d8ea27.jpg 1x" data-srcset="https://img.alange-soehne.com/product-tile-md-5/o-dpr-2/c4e8781028665c79b7cdeb252d79620d76d8ea27.jpg 2x, https://img.alange-soehne.com/product-tile-md-5/c4e8781028665c79b7cdeb252d79620d76d8ea27.jpg 1x"><source media="(min-width: 568px)" srcset="https://img.alange-soehne.com/product-tile-sm-5/o-dpr-2/c4e8781028665c79b7cdeb252d79620d76d8ea27.jpg 2x, https://img.alange-soehne.com/product-tile-sm-5/c4e8781028665c79b7cdeb252d79620d76d8ea27.jpg 1x" data-srcset="https://img.alange-soehne.com/product-tile-sm-5/o-dpr-2/c4e8781028665c79b7cdeb252d79620d76d8ea27.jpg 2x, https://img.alange-soehne.com/product-tile-sm-5/c4e8781028665c79b7cdeb252d79620d76d8ea27.jpg 1x"><source media="(min-width: 376px)" srcset="https://img.alange-soehne.com/product-tile-xs-5/o-dpr-2/c4e8781028665c79b7cdeb252d79620d76d8ea27.jpg 2x, https://img.alange-soehne.com/product-tile-xs-5/c4e8781028665c79b7cdeb252d79620d76d8ea27.jpg 1x" data-srcset="https://img.alange-soehne.com/product-tile-xs-5/o-dpr-2/c4e8781028665c79b7cdeb252d79620d76d8ea27.jpg 2x, https://img.alange-soehne.com/product-tile-xs-5/c4e8781028665c79b7cdeb252d79620d76d8ea27.jpg 1x"><img src="https://img.alange-soehne.com/product-tile-5/c4e8781028665c79b7cdeb252d79620d76d8ea27.jpg" data-src="https://img.alange-soehne.com/product-tile-5/c4e8781028665c79b7cdeb252d79620d76d8ea27.jpg" data-srcset="https://img.alange-soehne.com/product-tile-5/o-dpr-2/c4e8781028665c79b7cdeb252d79620d76d8ea27.jpg 2x, https://img.alange-soehne.com/product-tile-5/c4e8781028665c79b7cdeb252d79620d76d8ea27.jpg 1x" class=" ls-is-cached lazyloaded" alt="ZEITWERK DATE" srcset="https://img.alange-soehne.com/product-tile-5/o-dpr-2/c4e8781028665c79b7cdeb252d79620d76d8ea27.jpg 2x, https://img.alange-soehne.com/product-tile-5/c4e8781028665c79b7cdeb252d79620d76d8ea27.jpg 1x"></picture></div><div class="product-card__description"><a href="https://www.alange-soehne.com/au-en/timepieces/zeitwerk/zeitwerk-date/zeitwerk-date-in-750-pink-gold-148-033" data-tracking="{&quot;event&quot;:&quot;select_item&quot;,&quot;ecommerce&quot;:{&quot;currency&quot;:&quot;AUD&quot;,&quot;items&quot;:[{&quot;item_id&quot;:&quot;LS1484AA&quot;,&quot;item_name&quot;:&quot;ZEITWERK DATE&quot;,&quot;item_brand&quot;:&quot;als&quot;,&quot;item_category&quot;:&quot;Watches&quot;,&quot;item_collection&quot;:&quot;ZEITWERK DATE&quot;,&quot;item_sellable&quot;:&quot;notsellable&quot;,&quot;currency&quot;:&quot;&quot;,&quot;price&quot;:&quot;&quot;,&quot;item_variant&quot;:&quot;&quot;,&quot;item_line&quot;:&quot;&quot;}],&quot;_currency&quot;:{&quot;AU&quot;:&quot;AUD&quot;}}}" class="product-card__link expand-target"><div class="product-card__name" dir="ltr">ZEITWERK DATE</div><div class="product-card__collection">in 750 pink gold</div><div class="product-card__ref" dir="ltr">148.033</div><div class="product-price product-price--small"><span class="product-price__value">Price upon request</span><!----></div></a><!----></div><ul role="presentation" class="product-card__actions"><li role="presentation"><button class="btn btn--icon btn--icon-only" aria-label="Add to your favourites" data-cy="wishlist-button" data-tracking="{&quot;event&quot;:&quot;add_to_wishlist&quot;,&quot;page_type&quot;:&quot;Collections&quot;,&quot;wishlist_name&quot;:&quot;wishlist&quot;,&quot;items&quot;:[{&quot;item_id&quot;:&quot;LS1484AA&quot;,&quot;item_name&quot;:&quot;ZEITWERK DATE&quot;,&quot;item_brand&quot;:&quot;als&quot;,&quot;item_category&quot;:&quot;Watches&quot;,&quot;item_collection&quot;:&quot;ZEITWERK DATE&quot;,&quot;item_sellable&quot;:&quot;notsellable&quot;,&quot;currency&quot;:&quot;&quot;,&quot;price&quot;:&quot;&quot;,&quot;item_variant&quot;:&quot;&quot;,&quot;item_line&quot;:&quot;&quot;}]}"><span class="btn__icon"><svg class="icon icon--heart" aria-hidden="true" focusable="false" role="img"><!----><use xlink:href="https://www.alange-soehne.com/als/dist/assets/icons.svg?cacheKey=cb6db4d176ceb366adf83ad97a526c7f#heart"></use></svg></span><!----></button></li></ul></div>
---

## HTML Selectors (Detail Page)
jlc 
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
                                                            <a type="button" href="https://www.jaeger-lecoultre.com/au-en/light-checkout?reference=Q389257J" class="btn btn--default btn--full btn--icon btn--negative " data-cy="light-ecom-btn" data-tracking="{&quot;event&quot;:&quot;order_online_form&quot;,&quot;ecommerce&quot;:{&quot;currency&quot;:&quot;AUD&quot;,&quot;userstatus&quot;:&quot;guest&quot;,&quot;items&quot;:[{&quot;item_id&quot;:&quot;Q389257J&quot;,&quot;item_name&quot;:&quot;Chronograph&quot;,&quot;item_brand&quot;:&quot;jlc&quot;,&quot;item_category&quot;:&quot;Watches&quot;,&quot;item_collection&quot;:&quot;Reverso Tribute&quot;,&quot;item_sellable&quot;:&quot;notsellable&quot;,&quot;currency&quot;:&quot;AUD&quot;,&quot;price&quot;:&quot;68000.00&quot;,&quot;item_variant&quot;:&quot;&quot;,&quot;item_line&quot;:&quot;&quot;}]}}" data-product-reference="Q389257J" data-base-model-reference="Q389257J" data-algolia-insights="{&quot;objectIDs&quot;:[&quot;Page::3586&quot;],&quot;index&quot;:&quot;products&quot;,&quot;eventName&quot;:&quot;Product added to Cart&quot;,&quot;type&quot;:&quot;addToCart&quot;}" data-uw-rm-brl="PR" data-uw-original-href="https://www.jaeger-lecoultre.com/au-en/light-checkout?reference=Q389257J">
        <span class="btn__text" data-uw-trigger="" data-uw-ignore-s25="" aria-haspopup="dialog">Pre-order now</span>

                    <span class="btn__icon pointer-events-none">
                <svg class="icon icon--cart-16 " aria-hidden="true" focusable="false" role="img" data-uw-rm-br-ar-ref-lb="" data-uw-rm-sr="" data-uw-rm-br-ar-ref-ids-aria-labelledby="icon-691d9a21615c30000">
                <use href="https://www.jaeger-lecoultre.com/jlc/dist/assets/icons.svg?cacheKey=b81f1f6a799799d00514031b7b625ae3#cart-16"></use>
    </svg>
            </span>
            </a>



                                                                    <a href="tel:+61 2 8663 8028" type="button" class="btn btn--default btn--icon btn--full" data-cy="shop-by-phone-btn" data-country-code="AU" data-tracking="{&quot;event&quot;:&quot;call_center&quot;,&quot;button_position&quot;:&quot;product_page&quot;,&quot;button_type&quot;:&quot;buy&quot;,&quot;items&quot;:[{&quot;item_id&quot;:&quot;Q389257J&quot;,&quot;item_name&quot;:&quot;Chronograph&quot;,&quot;item_brand&quot;:&quot;jlc&quot;,&quot;item_category&quot;:&quot;Watches&quot;,&quot;item_collection&quot;:&quot;Reverso Tribute&quot;,&quot;item_sellable&quot;:&quot;notsellable&quot;,&quot;currency&quot;:&quot;AUD&quot;,&quot;price&quot;:&quot;68000.00&quot;,&quot;item_variant&quot;:&quot;&quot;,&quot;item_line&quot;:&quot;&quot;}]}" data-algolia-insights="{&quot;objectIDs&quot;:[&quot;Page::3586&quot;],&quot;index&quot;:&quot;products&quot;,&quot;eventName&quot;:&quot;Product converted&quot;,&quot;type&quot;:&quot;conversion&quot;}" aria-label="call +61 2 8663 8028" data-uw-rm-vglnk="" uw-rm-vague-link-id="tel:+61 2 8663 8028$call +61 2 8663 8028">
        <span class="btn__text" data-uw-trigger="" data-uw-ignore-s25="" aria-haspopup="dialog">Inquire by phone</span>

                    <span class="btn__icon pointer-events-none">
                <svg class="icon icon--phone-16 " aria-hidden="true" focusable="false" role="img" data-uw-rm-br-ar-ref-lb="" data-uw-rm-sr="" data-uw-rm-br-ar-ref-ids-aria-labelledby="icon-691d9a216168c0000">
                <use href="https://www.jaeger-lecoultre.com/jlc/dist/assets/icons.svg?cacheKey=b81f1f6a799799d00514031b7b625ae3#phone-16"></use>
    </svg>
            </span>
            </a>
                                
                                
                                <a href="https://www.jaeger-lecoultre.com/au-en/boutique-appointment?reference=Q389257J" type="button" class="btn btn--default btn--full btn--icon" data-tracking="{&quot;event&quot;:&quot;baa_selected&quot;,&quot;boutique_id&quot;:null}" data-algolia-insights="{&quot;objectIDs&quot;:[&quot;Page::3586&quot;],&quot;index&quot;:&quot;products&quot;,&quot;eventName&quot;:&quot;Product converted&quot;,&quot;type&quot;:&quot;conversion&quot;}" data-uw-rm-brl="PR" data-uw-original-href="https://www.jaeger-lecoultre.com/au-en/boutique-appointment?reference=Q389257J">
    <span class="btn__text" data-uw-trigger="" data-uw-ignore-s25="" aria-haspopup="dialog">Book an appointment</span>
    <span class="btn__icon pointer-events-none">
        <svg class="icon icon--clock-16 " aria-hidden="true" focusable="false" role="img" data-uw-rm-br-ar-ref-lb="" data-uw-rm-sr="" data-uw-rm-br-ar-ref-ids-aria-labelledby="icon-691d9a21617270000">
                <use href="https://www.jaeger-lecoultre.com/jlc/dist/assets/icons.svg?cacheKey=b81f1f6a799799d00514031b7b625ae3#clock-16"></use>
    </svg>
    </span>
</a>

                                <a href="https://wa.me/+61483905200" target="_blank" type="button" data-tracking="{&quot;event&quot;:&quot;whatsapp&quot;,&quot;items&quot;:[{&quot;item_id&quot;:&quot;Q389257J&quot;,&quot;item_name&quot;:&quot;Chronograph&quot;,&quot;item_brand&quot;:&quot;jlc&quot;,&quot;item_category&quot;:&quot;Watches&quot;,&quot;item_collection&quot;:&quot;Reverso Tribute&quot;,&quot;item_sellable&quot;:&quot;notsellable&quot;,&quot;currency&quot;:&quot;AUD&quot;,&quot;price&quot;:&quot;68000.00&quot;,&quot;item_variant&quot;:&quot;&quot;,&quot;item_line&quot;:&quot;&quot;}]}" class="btn btn--default btn--full" data-algolia-insights="{&quot;objectIDs&quot;:[&quot;Page::3586&quot;],&quot;index&quot;:&quot;products&quot;,&quot;eventName&quot;:&quot;Product converted&quot;,&quot;type&quot;:&quot;conversion&quot;}" data-uw-rm-brl="PR" data-uw-original-href="https://wa.me/+61483905200" aria-label="WhatsApp - open in a new tab" data-uw-rm-ext-link="" uw-rm-external-link-id="https://wa.me/+61483905200$whatsapp">
        <span class="btn__text" data-uw-trigger="" data-uw-ignore-s25="" aria-haspopup="dialog">WhatsApp</span>
        <span class="btn__icon pointer-events-none">
            <svg class="icon icon--whatsapp-16 " aria-hidden="true" focusable="false" role="img" data-uw-rm-br-ar-ref-lb="" data-uw-rm-sr="" data-uw-rm-br-ar-ref-ids-aria-labelledby="icon-691d9a2161b840000">
                <use href="https://www.jaeger-lecoultre.com/jlc/dist/assets/icons.svg?cacheKey=b81f1f6a799799d00514031b7b625ae3#whatsapp-16"></use>
    </svg>
        </span>
    </a>

                                
                                                                    <span id="show-sticky-add-to-bag"></span>
                                                                                    </div>

                        
                        
                        <ul class="accordion menu menu--border-full-width product-page-details__description-accordion">
    
    <li class="menu__item accordion__item">
    <button class="accordion__title menu__entry menu__link menu__toggle accordion__toggle " data-toggle="collapse" data-target="#product-accordion-tab-description" aria-expanded="true">
        Description
        <svg class="icon icon--chevron-down-10 icon--12" focusable="false" aria-labelledby="icon-691d9a21626680000" role="img">
                    <title id="icon-691d9a21626680000">Description</title>
                <use href="https://www.jaeger-lecoultre.com/jlc/dist/assets/icons.svg?cacheKey=b81f1f6a799799d00514031b7b625ae3#chevron-down-10"></use>
    </svg>
    </button>

            <div id="product-accordion-tab-description" class="accordion__content collapse is-expanded" style="height: auto;">
            
                <div class="product-page-details__infos_text">
            <p>Exceptional complication reinvented. This is the promise of the new Reverso Tribute Chronograph, which features an hour-minute display on its two dials with contrasting and complementary styles. The front dial soberly displays the aesthetic codes of the Tribute line: gadroons, “railroad” minute track, applied hour-markers and Dauphine hands stand out against the sunray black dial. Once turned over on its cradle, the watch reveals a meticulously crafted open-worked reverse that unveils every detail of the new Manufacture Calibre 860 and the formidable mechanics of the retrograde chronograph: hour markers and minute track that seem to float above the movement, blue hands, bevelled bridges, Côtes de Genève… in leather or bi-material (leather/canvas), two interchangeable straps in Casa Fagliano design provide the watch with either a natural or a more sophisticated look.</p>
        </div>

                
                    </div>
    </li>

    
    <li class="menu__item accordion__item">
    <button class="accordion__title menu__entry menu__link menu__toggle accordion__toggle " data-toggle="collapse" data-target="#product-accordion-tab-feature" aria-expanded="true">
        Features
        <svg class="icon icon--chevron-down-10 icon--12" focusable="false" aria-labelledby="icon-691d9a2162b3c0000" role="img">
                    <title id="icon-691d9a2162b3c0000">Features</title>
                <use href="https://www.jaeger-lecoultre.com/jlc/dist/assets/icons.svg?cacheKey=b81f1f6a799799d00514031b7b625ae3#chevron-down-10"></use>
    </svg>
    </button>

            <div id="product-accordion-tab-feature" class="accordion__content collapse is-expanded" style="height: auto;">
            
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
    <button class="accordion__title menu__entry menu__link menu__toggle accordion__toggle " data-toggle="collapse" data-target="#product-accordion-tab-movement" aria-expanded="true">
        Movement
        <svg class="icon icon--chevron-down-10 icon--12" focusable="false" aria-labelledby="icon-691d9a2164d6f0000" role="img">
                    <title id="icon-691d9a2164d6f0000">Movement</title>
                <use href="https://www.jaeger-lecoultre.com/jlc/dist/assets/icons.svg?cacheKey=b81f1f6a799799d00514031b7b625ae3#chevron-down-10"></use>
    </svg>
    </button>

            <div id="product-accordion-tab-movement" class="accordion__content collapse is-expanded" style="height: auto;">
            
                <div class="mb-sm text-center bg-media">
                    <div class="picture">
                        <picture>
                    
            <img src="https://img.jaeger-lecoultre.com/product-specifications-movement-1/771ff13ed9c04ba936b9603e6492d81a6f24b842.jpg" data-src="https://img.jaeger-lecoultre.com/product-specifications-movement-1/771ff13ed9c04ba936b9603e6492d81a6f24b842.jpg" data-srcset="https://img.jaeger-lecoultre.com/product-specifications-movement-1/o-dpr-2/771ff13ed9c04ba936b9603e6492d81a6f24b842.jpg 2x, https://img.jaeger-lecoultre.com/product-specifications-movement-1/771ff13ed9c04ba936b9603e6492d81a6f24b842.jpg 1x" alt="Jaeger-LeCoultre Calibre 860" class="m-auto lazyloaded" data-uw-rm-alt-original="Jaeger-LeCoultre Calibre 860" data-uw-rm-alt="ALT" srcset="https://img.jaeger-lecoultre.com/product-specifications-movement-1/o-dpr-2/771ff13ed9c04ba936b9603e6492d81a6f24b842.jpg 2x, https://img.jaeger-lecoultre.com/product-specifications-movement-1/771ff13ed9c04ba936b9603e6492d81a6f24b842.jpg 1x">

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
                        <div id="tooltip-691d9a21641fa" class="tooltip tooltip--touch-enabled product-page-details__infos_subtitle__tooltip tooltip--minimal" data-options="{&quot;placement&quot;:&quot;top-start&quot;,&quot;enableArrow&quot;:false,&quot;offset&quot;:5,&quot;enableTouch&quot;:true}">
    <div class="tooltip__trigger" aria-describedby="tooltip-content-tooltip-691d9a21641fa" tabindex="0">
        <button type="button" class="btn btn--xs btn--default btn--icon-only btn--icon" aria-label="Discover more" data-uw-rm-empty-ctrl="">
            <span class="sr-only">
                Discover more
            </span>

            <span class="btn__icon">
                <svg class="icon icon--info-12 icon--bidirectional icon--12" aria-hidden="true" focusable="false" role="img" data-uw-rm-br-ar-ref-lb="" data-uw-rm-sr="" data-uw-rm-br-ar-ref-ids-aria-labelledby="icon-691d9a21642400000">
                <use href="https://www.jaeger-lecoultre.com/jlc/dist/assets/icons.svg?cacheKey=b81f1f6a799799d00514031b7b625ae3#info-12"></use>
    </svg>
            </span>
        </button>
    </div>

    <div id="tooltip-content-tooltip-691d9a21641fa" class="tooltip__content" role="tooltip">
        The balance makes a to-and-fro movement at a given frequency (two vibrations). It is measured either in Vibration per Hour (VPH) or Hertz (Hz).
    </div>
</div>

                    </div>

                    <div class="product-page-details__infos_text">
                                                    28800                                             </div>
                                    <div class="product-page-details__infos_start" data-tooltip-key="ProductPage.specification.standardizedFrequenceHz.tooltip">
                        <h5 class="product-page-details__infos_subtitle">Frequency (HZ)</h5>
                        <div id="tooltip-691d9a21642db" class="tooltip tooltip--touch-enabled product-page-details__infos_subtitle__tooltip tooltip--minimal" data-options="{&quot;placement&quot;:&quot;top-start&quot;,&quot;enableArrow&quot;:false,&quot;offset&quot;:5,&quot;enableTouch&quot;:true}">
    <div class="tooltip__trigger" aria-describedby="tooltip-content-tooltip-691d9a21642db" tabindex="0">
        <button type="button" class="btn btn--xs btn--default btn--icon-only btn--icon" aria-label="Discover more" data-uw-rm-empty-ctrl="">
            <span class="sr-only">
                Discover more
            </span>

            <span class="btn__icon">
                <svg class="icon icon--info-12 icon--bidirectional icon--12" aria-hidden="true" focusable="false" role="img" data-uw-rm-br-ar-ref-lb="" data-uw-rm-sr="" data-uw-rm-br-ar-ref-ids-aria-labelledby="icon-691d9a21642fa0000">
                <use href="https://www.jaeger-lecoultre.com/jlc/dist/assets/icons.svg?cacheKey=b81f1f6a799799d00514031b7b625ae3#info-12"></use>
    </svg>
            </span>
        </button>
    </div>

    <div id="tooltip-content-tooltip-691d9a21642db" class="tooltip__content" role="tooltip">
        The balance makes a to-and-fro movement at a given frequency (two vibrations). It is measured either in Vibration per Hour (VPH) or Hertz (Hz).
    </div>
</div>

                    </div>

                    <div class="product-page-details__infos_text">
                                                    4                                             </div>
                                    <div class="product-page-details__infos_start" data-tooltip-key="ProductPage.specification.standardizedPowerReserve.tooltip">
                        <h5 class="product-page-details__infos_subtitle">Power reserve</h5>
                        <div id="tooltip-691d9a2164373" class="tooltip tooltip--touch-enabled product-page-details__infos_subtitle__tooltip tooltip--minimal" data-options="{&quot;placement&quot;:&quot;top-start&quot;,&quot;enableArrow&quot;:false,&quot;offset&quot;:5,&quot;enableTouch&quot;:true}">
    <div class="tooltip__trigger" aria-describedby="tooltip-content-tooltip-691d9a2164373" tabindex="0">
        <button type="button" class="btn btn--xs btn--default btn--icon-only btn--icon" aria-label="Discover more" data-uw-rm-empty-ctrl="">
            <span class="sr-only">
                Discover more
            </span>

            <span class="btn__icon">
                <svg class="icon icon--info-12 icon--bidirectional icon--12" aria-hidden="true" focusable="false" role="img" data-uw-rm-br-ar-ref-lb="" data-uw-rm-sr="" data-uw-rm-br-ar-ref-ids-aria-labelledby="icon-691d9a216438e0000">
                <use href="https://www.jaeger-lecoultre.com/jlc/dist/assets/icons.svg?cacheKey=b81f1f6a799799d00514031b7b625ae3#info-12"></use>
    </svg>
            </span>
        </button>
    </div>

    <div id="tooltip-content-tooltip-691d9a2164373" class="tooltip__content" role="tooltip">
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
                        <div id="tooltip-691d9a216440f" class="tooltip tooltip--touch-enabled product-page-details__infos_subtitle__tooltip tooltip--minimal" data-options="{&quot;placement&quot;:&quot;top-start&quot;,&quot;enableArrow&quot;:false,&quot;offset&quot;:5,&quot;enableTouch&quot;:true}">
    <div class="tooltip__trigger" aria-describedby="tooltip-content-tooltip-691d9a216440f" tabindex="0">
        <button type="button" class="btn btn--xs btn--default btn--icon-only btn--icon" aria-label="Discover more" data-uw-rm-empty-ctrl="">
            <span class="sr-only">
                Discover more
            </span>

            <span class="btn__icon">
                <svg class="icon icon--info-12 icon--bidirectional icon--12" aria-hidden="true" focusable="false" role="img" data-uw-rm-br-ar-ref-lb="" data-uw-rm-sr="" data-uw-rm-br-ar-ref-ids-aria-labelledby="icon-691d9a21644290000">
                <use href="https://www.jaeger-lecoultre.com/jlc/dist/assets/icons.svg?cacheKey=b81f1f6a799799d00514031b7b625ae3#info-12"></use>
    </svg>
            </span>
        </button>
    </div>

    <div id="tooltip-content-tooltip-691d9a216440f" class="tooltip__content" role="tooltip">
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
                                            <a href="https://www.jaeger-lecoultre.com/au-en/services/customer-care-watches" class="btn btn--default btn--sm btn--full btn--icon btn--centered-with-icon" data-uw-rm-brl="PR" data-uw-original-href="https://www.jaeger-lecoultre.com/au-en/services/customer-care-watches" aria-label="Maintenance advice" data-uw-rm-empty-ctrl="">
                            <span class="btn__text" data-uw-trigger="" data-uw-ignore-s25="" aria-haspopup="dialog">Maintenance advice</span>
                            <span class="btn__icon pointer-events-none">
                                <svg class="icon icon--arrow-16 icon--bidirectional " aria-hidden="true" focusable="false" role="img" data-uw-rm-br-ar-ref-lb="" data-uw-rm-sr="" data-uw-rm-br-ar-ref-ids-aria-labelledby="icon-691d9a21644790000">
                <use href="https://www.jaeger-lecoultre.com/jlc/dist/assets/icons.svg?cacheKey=b81f1f6a799799d00514031b7b625ae3#arrow-16"></use>
    </svg>
                            </span>
                        </a>
                    
                                            <button id="download-manual-button" class="btn btn--default btn--sm btn--full btn--icon btn--centered-with-icon" aria-label="Download the user manual" data-uw-rm-empty-ctrl="">
                            <span class="btn__text" data-uw-trigger="" data-uw-ignore-s25="" aria-haspopup="dialog">Download the user manual</span>
                            <span class="btn__icon pointer-events-none">
                                <svg class="icon icon--download-16 " aria-hidden="true" focusable="false" role="img" data-uw-rm-br-ar-ref-lb="" data-uw-rm-sr="" data-uw-rm-br-ar-ref-ids-aria-labelledby="icon-691d9a2164d2c0000">
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
        <svg class="icon icon--chevron-down-10 icon--12" focusable="false" aria-labelledby="icon-691d9a216888a0000" role="img">
                    <title id="icon-691d9a216888a0000">Straps &amp; Buckles</title>
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
        <a href="https://www.jaeger-lecoultre.com/au-en/straps/fagliano-collection/fagliano-collection-grey-strap-qc35cf72" class="product-card__link expand-target" data-uw-rm-brl="PR" data-uw-original-href="https://www.jaeger-lecoultre.com/au-en/straps/fagliano-collection/fagliano-collection-grey-strap-qc35cf72" aria-label="Expand this block" data-uw-rm-empty-ctrl="">
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
        <a href="https://www.jaeger-lecoultre.com/au-en/straps/fagliano-collection/fagliano-collection-black-strap-qc05c72c" class="product-card__link expand-target" data-uw-rm-brl="PR" data-uw-original-href="https://www.jaeger-lecoultre.com/au-en/straps/fagliano-collection/fagliano-collection-black-strap-qc05c72c" aria-label="Expand this block" data-uw-rm-empty-ctrl="">
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
                                <div class="reassurance-banner reassurance-banner--column page_speed_1094695682">
                                      <button class="reassurance-banner__item" data-modal-open="modal-item-691d9a20cd3be0000">
    <svg class="icon icon--delivery-24 icon--24" aria-hidden="true" focusable="false" role="img" data-uw-rm-br-ar-ref-lb="" data-uw-rm-sr="" data-uw-rm-br-ar-ref-ids-aria-labelledby="icon-691d9a216943a0000">
                <use href="https://www.jaeger-lecoultre.com/jlc/dist/assets/icons.svg?cacheKey=b81f1f6a799799d00514031b7b625ae3#delivery-24"></use>
    </svg>

    <div class="h5 reassurance-banner__title">FREE DELIVERY &amp; RETURNS</div>

            <svg class="icon icon--plus-alt-16 icon--16 reassurance-banner--column__icon-end" aria-hidden="true" focusable="false" role="img" data-uw-rm-br-ar-ref-lb="" data-uw-rm-sr="" data-uw-rm-br-ar-ref-ids-aria-labelledby="icon-691d9a21694520000">
                <use href="https://www.jaeger-lecoultre.com/jlc/dist/assets/icons.svg?cacheKey=b81f1f6a799799d00514031b7b625ae3#plus-alt-16"></use>
    </svg>
    </button>
                                                                            <button class="reassurance-banner__item" data-modal-open="modal-item-691d9a20cd4f00000">
    <svg class="icon icon--credit-card-24 icon--24" aria-hidden="true" focusable="false" role="img" data-uw-rm-br-ar-ref-lb="" data-uw-rm-sr="" data-uw-rm-br-ar-ref-ids-aria-labelledby="icon-691d9a21694770000">
                <use href="https://www.jaeger-lecoultre.com/jlc/dist/assets/icons.svg?cacheKey=b81f1f6a799799d00514031b7b625ae3#credit-card-24"></use>
    </svg>

    <div class="h5 reassurance-banner__title">SECURE PAYMENT</div>

            <svg class="icon icon--plus-alt-16 icon--16 reassurance-banner--column__icon-end" aria-hidden="true" focusable="false" role="img" data-uw-rm-br-ar-ref-lb="" data-uw-rm-sr="" data-uw-rm-br-ar-ref-ids-aria-labelledby="icon-691d9a21694860000">
                <use href="https://www.jaeger-lecoultre.com/jlc/dist/assets/icons.svg?cacheKey=b81f1f6a799799d00514031b7b625ae3#plus-alt-16"></use>
    </svg>
    </button>
                                                                            <button class="reassurance-banner__item" data-modal-open="modal-item-691d9a20cd6030000">
    <svg class="icon icon--swiss-made-24 icon--24" aria-hidden="true" focusable="false" role="img" data-uw-rm-br-ar-ref-lb="" data-uw-rm-sr="" data-uw-rm-br-ar-ref-ids-aria-labelledby="icon-691d9a21694a30000">
                <use href="https://www.jaeger-lecoultre.com/jlc/dist/assets/icons.svg?cacheKey=b81f1f6a799799d00514031b7b625ae3#swiss-made-24"></use>
    </svg>

    <div class="h5 reassurance-banner__title">SWISS MADE</div>

            <svg class="icon icon--plus-alt-16 icon--16 reassurance-banner--column__icon-end" aria-hidden="true" focusable="false" role="img" data-uw-rm-br-ar-ref-lb="" data-uw-rm-sr="" data-uw-rm-br-ar-ref-ids-aria-labelledby="icon-691d9a21694b10000">
                <use href="https://www.jaeger-lecoultre.com/jlc/dist/assets/icons.svg?cacheKey=b81f1f6a799799d00514031b7b625ae3#plus-alt-16"></use>
    </svg>
    </button>
                                                                            <button class="reassurance-banner__item" data-modal-open="modal-item-691d9a20cd70b0000">
    <svg class="icon icon--care-24 icon--24" aria-hidden="true" focusable="false" role="img" data-uw-rm-br-ar-ref-lb="" data-uw-rm-sr="" data-uw-rm-br-ar-ref-ids-aria-labelledby="icon-691d9a21694cd0000">
                <use href="https://www.jaeger-lecoultre.com/jlc/dist/assets/icons.svg?cacheKey=b81f1f6a799799d00514031b7b625ae3#care-24"></use>
    </svg>

    <div class="h5 reassurance-banner__title">UP TO 8 YEARS OF WARRANTY</div>

            <svg class="icon icon--plus-alt-16 icon--16 reassurance-banner--column__icon-end" aria-hidden="true" focusable="false" role="img" data-uw-rm-br-ar-ref-lb="" data-uw-rm-sr="" data-uw-rm-br-ar-ref-ids-aria-labelledby="icon-691d9a21694da0000">
                <use href="https://www.jaeger-lecoultre.com/jlc/dist/assets/icons.svg?cacheKey=b81f1f6a799799d00514031b7b625ae3#plus-alt-16"></use>
    </svg>
    </button>
                                                                            <button class="reassurance-banner__item" data-modal-open="modal-item-691d9a20cd8100000">
    <svg class="icon icon--watch-maker-24 icon--24" aria-hidden="true" focusable="false" role="img" data-uw-rm-br-ar-ref-lb="" data-uw-rm-sr="" data-uw-rm-br-ar-ref-ids-aria-labelledby="icon-691d9a21694f50000">
                <use href="https://www.jaeger-lecoultre.com/jlc/dist/assets/icons.svg?cacheKey=b81f1f6a799799d00514031b7b625ae3#watch-maker-24"></use>
    </svg>

    <div class="h5 reassurance-banner__title">AFTER-SALE SERVICES</div>

            <svg class="icon icon--plus-alt-16 icon--16 reassurance-banner--column__icon-end" aria-hidden="true" focusable="false" role="img" data-uw-rm-br-ar-ref-lb="" data-uw-rm-sr="" data-uw-rm-br-ar-ref-ids-aria-labelledby="icon-691d9a21695020000">
                <use href="https://www.jaeger-lecoultre.com/jlc/dist/assets/icons.svg?cacheKey=b81f1f6a799799d00514031b7b625ae3#plus-alt-16"></use>
    </svg>
    </button>
                                                                    </div>
                            </div>
                        
                        
                        
                        
                                                    <h5 class="mt-md mb-sm" role="heading" aria-level="3" data-uw-rm-heading="level">Personalise your watch</h5>
                            <div class="duo-button duo-button--stacked duo-button--full">
                                <div class="duo-button__wrapper">
                                                                            <a href="https://www.jaeger-lecoultre.com/au-en/strap-search?reference=Q389257J" class="btn btn--default btn--xs btn--even btn--outlined btn--full btn--icon btn--description-icons-start-end" data-uw-rm-brl="PR" data-uw-original-href="https://www.jaeger-lecoultre.com/au-en/strap-search?reference=Q389257J">
                                        <span class="btn__icon btn__icon--start">
                                            <svg class="icon icon--strap-watch-36 icon--36" aria-hidden="true" focusable="false" role="img" data-uw-rm-br-ar-ref-lb="" data-uw-rm-sr="" data-uw-rm-br-ar-ref-ids-aria-labelledby="icon-691d9a21695350000">
                <use href="https://www.jaeger-lecoultre.com/jlc/dist/assets/icons.svg?cacheKey=b81f1f6a799799d00514031b7b625ae3#strap-watch-36"></use>
    </svg>
                                        </span>

                                            <span class="btn__text" data-description="Add another compatible strap" data-uw-trigger="" data-uw-ignore-s25="" aria-haspopup="dialog">
                                            Strap finder
                                        </span>

                                            <span class="btn__icon btn__icon--end">
                                            <svg class="icon icon--arrow-16 icon--bidirectional " aria-hidden="true" focusable="false" role="img" data-uw-rm-br-ar-ref-lb="" data-uw-rm-sr="" data-uw-rm-br-ar-ref-ids-aria-labelledby="icon-691d9a21695440000">
                <use href="https://www.jaeger-lecoultre.com/jlc/dist/assets/icons.svg?cacheKey=b81f1f6a799799d00514031b7b625ae3#arrow-16"></use>
    </svg>
                                        </span>
                                        </a>
                                                                    </div>
                            </div>
                                            </div>


als
<div class="panel__content panel__content--boxed ">
            <div class="technical-details-panel__block">
                    <div class="technical-details-panel__block-title">Model Details</div>

                    <ul class="technical-details-panel__detail-list">
                                                    <div class="technical-details-panel__detail-title">
                                Reference
                            </div>

                            <li><span dir="ltr">148.033</span> / <span dir="ltr">LSLS1484AA</span></li>
                                                    <div class="technical-details-panel__detail-title">
                                Dial colour
                            </div>

                            <li>Grey</li>
                                            </ul>
                </div>
                            <div class="technical-details-panel__block">
                    <div class="technical-details-panel__block-title">Case</div>

                    <ul class="technical-details-panel__detail-list">
                                                    <div class="technical-details-panel__detail-title">
                                Case material
                            </div>

                            <li>18-carat pink gold<br>Case back: sapphire glass</li>
                                                    <div class="technical-details-panel__detail-title">
                                Case dimension
                            </div>

                            <li>Case diameter: 44.2 mm<br>Case thickness: 12.3 mm</li>
                                                    <div class="technical-details-panel__detail-title">
                                Water resistance
                            </div>

                            <li>3 bar</li>
                                            </ul>
                </div>
                            <div class="technical-details-panel__block">
                    <div class="technical-details-panel__block-title">Movement</div>

                    <ul class="technical-details-panel__detail-list">
                                                    <div class="technical-details-panel__detail-title">
                                Movement designation
                            </div>

                            <li>L043.8</li>
                                                    <div class="technical-details-panel__detail-title">
                                Number of movement parts
                            </div>

                            <li>516</li>
                                                    <div class="technical-details-panel__detail-title">
                                Winding mechanism
                            </div>

                            <li>Manually wound movement</li>
                                                    <div class="technical-details-panel__detail-title">
                                Power reserve
                            </div>

                            <li>72 hours</li>
                                                    <div class="technical-details-panel__detail-title">
                                Balance frequency
                            </div>

                            <li>18,000 semi-oscillations per hour (2.5 Hz)</li>
                                                    <div class="technical-details-panel__detail-title">
                                Functions
                            </div>

                            <li>Power reserve indication, Constant-force escapement, Ring-date display</li>
                                            </ul>
                </div>
                            <div class="technical-details-panel__block">
                    <div class="technical-details-panel__block-title">Strap</div>

                    <ul class="technical-details-panel__detail-list">
                                                    <div class="technical-details-panel__detail-title">
                                Leather Strap
                            </div>

                            <li>Dark brown, Alligator leather</li>
                                                    <div class="technical-details-panel__detail-title">
                                
                            </div>

                            <li>Our alligator straps fully comply with the CITES regulations: Species – alligator mississippiensis. Extraction method – farmed. CITES Appendix – Appendix II</li>
                                                    <div class="technical-details-panel__detail-title">
                                Prong buckle
                            </div>

                            <li>18-carat pink gold</li>
                                            </ul>
                </div>
        </div>