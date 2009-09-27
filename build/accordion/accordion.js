YUI.add('accordion', function(Y) {

/**
 * Provides the Accordion class
 *
 * @module accordion
 */

(function(){

/**
 * Accordion creates an widget, consists of one or more items, which can be collapsed, expanded,
 * set as always visible and reordered by using Drag&Drop. Collapsing/expanding might be animated.
 * 
 * @param _config {Object} Object literal specifying Accordion configuration properties.
 *
 * @class Accordion
 * @constructor
 * @extends Widget
 */

function Accordion( _config ){
    Accordion.superclass.constructor.apply( this, arguments );
}

// Local constants
var Lang  = Y.Lang,
    Node  = Y.Node,
    Anim  = Y.Anim,
    Easing = Y.Easing,
    AccName = "accordion",
    WidgetStdMod = Y.WidgetStdMod,
    QuirksMode = document.compatMode == "BackCompat",
    IEQuirksMode = QuirksMode && Y.UA.ie > 0,
    COLLAPSE_HEIGHT = IEQuirksMode ? 1 : 0,
    getCN = Y.ClassNameManager.getClassName;


/**
 *  Static property provides a string to identify the class.
 *
 * @property Accordion.NAME
 * @type String
 * @static
 */
Accordion.NAME = AccName;

/**
 * Static property used to define the default attribute 
 * configuration for the Accordion.
 * 
 * @property Accordion.ATTRS
 * @type Object
 * @static
 */
Accordion.ATTRS = {
    /**
     * @description The event on which Accordion should listen for user interactions.
     * The value can be also mousedown or mouseup. Mousedown event can be used if
     * drag&drop is not enabled
     *
     * @attribute itemChosen
     * @default click
     * @type String
     */
    itemChosen: {
        value: "click",
        validator: Lang.isString
    },

    /**
     * @description Contains the items, currently added to Accordion
     * 
     * @attribute items
     * @readOnly
     * @default []
     * @type Array
     */
    items: {
        value: [],
        readOnly: true,
        validator: Lang.isArray
    },
    
    /**
     * @attribute resizeEvent
     * 
     * @description The event on which Accordion should listen for resizing.
     * The value must be one of these:
     * <ul>
     *     <li> String "default" - the Accordion will subscribe to Y.windowresize event
     *     </li>
     *     <li> An object in the following form: 
     *         {
     *             sourceObject: some_javascript_object,
     *             resizeEvent: an_event_to_subscribe
     *         }
     *      </li>
     * </ul>
     * For example, if we are using LayoutManager's instance as sourceObject, we will have to use its "resize" event as resizeEvent
     *  
     * @default "default"
     * @type String or Object, see the description above
     */

    resizeEvent: {
        value: "default",
        validator: function( _value ){
            return (Lang.isString(_value) || Lang.isObject(_value));
        }
    },

    /**
     * @attribute useAnimation
     * @description Whether or not Accordion should use animation when expand or collapse some item
     * The animation in Accordion is slow in IE6
     * 
     * @default: true
     * @type boolean
     */
    useAnimation: {
        value: true,
        validator: Lang.isBoolean
    },

    /**
     * @attribute animation
     * @description Animation config values, see Y.Animation
     * 
     * @default <code> {
     *    duration: 1, 
     *    easing: Easing.easeOutStrong
     *  }
     *  </code>
     *  
     * @type Object
     */
    animation: {
        value: {
            duration: 1,
            easing: Easing.easeOutStrong
        },
        validator: function( _value ){
            return Lang.isObject( _value ) && Lang.isNumber( _value.duration ) &&
                Lang.isFunction( _value.easing );
        }
    },

    /**
     * @attribute reorderItems
     * @description Whether or not the items in Accordion can be reordered by using drag&drop
     * 
     * @default true
     * @type boolean
     */
    reorderItems: {
        value: true,
        validator: Lang.isBoolean
    },

    /**
     * @attribute collapseOthersOnExpand
     * @description If true, on item expanding, all other expanded and not set as always visible items, will be collapsed
     * Otherwise, they will stay open
     * 
     * @default true
     * @type Boolean
     */
    collapseOthersOnExpand: {
        value: true,
        validator: Lang.isBoolean
    }
};

/**
 *  Static property to indicate class which will be applied to dd proxy when item is being reordered
 *
 * @property Accordion.C_PROXY_VISIBLE
 * @type String
 * @static
 */
Accordion.C_PROXY_VISIBLE = getCN( AccName, "proxyel", "visible" );


/**
 * Static property, which contains the drag group for Accordion and its items
 *
 * @property Accordion.DRAGGROUP
 * @type String
 * @static
 */
Accordion.DRAGGROUP = "y_accordion";

/**
 * Static property; contains the events, which Accordion publishes
 *
 * @property Accordion.EVENT_TYPES
 * @type Object
 * @static
 */

Accordion.EVENT_TYPES = {

    BEFOREITEMADD: "beforeItemAdd",
    ITEMADDED: "itemAdded",

    BEFOREITEMREMOVE: "beforeItemRemove",
    ITEMREMOVED: "itemRemoved",

    BEFOREITEMERESIZED : "beforeItemResized",
    ITEMERESIZED : "itemResized",

    BEFOREITEMEXPAND  : "beforeItemExpand",
    BEFOREITEMCOLLAPSE : "beforeItemCollapse",
    ITEMEXPANDED : "itemExpanded",
    ITEMCOLLAPSED : "itemCollapsed",    

    BEFOREITEMREORDER : "beforeItemReorder",
    BEFOREENDITEMREORDER : "beforeEndItemReorder",
    ITEMREORDERED : "itemReordered"
};

// Accordion extends Widget

Y.extend( Accordion, Y.Widget, {

    /**
     * Initializer lifecycle implementation for the Accordion class. Publishes events,
     * initializes internal properties and subscribes for resize event.
     *
     * @method initializer
     * @protected
     * @param  _config {Object} Configuration object literal for the Accordion
     */
    initializer: function( _config ) {
        this._initEvents();

        this._lastChild = null;

        this.after( "render", function(){
            var _resizeEvent;

            _resizeEvent = this.get( "resizeEvent" );
            
            this._setUpResizing( _resizeEvent );
            
            this.after( "resizeEventChange", function( _data ) {
                this._setUpResizing( _data.newVal );
            }, this );
        }, this );

        this._forCollapsing = {};
        this._forExpanding  = {};
        this._animations    = {};
    },

    
    /**
     * Destructor lifecycle implementation for the Accordion class.
     * Removes and destroys all registered items.
     *
     * @method destructor
     * @protected
     */
    destructor: function() {
        var _items, _item, i, _length;
        
        _items = this.get( "items" );
        _length = _items.length;
        
        for( i = _length - 1; i >= 0; i-- ){
            _item = _items[ i ];
            
            _items.splice( i, 1 );
            
            this._removeItemHandles( _item );
            
            _item.destroy();
        }
    },

    
    /**
     * Publishes Accordion's events
     *
     * @method _initEvents
     * @protected
     */
    _initEvents: function(){
        var _events = Accordion.EVENT_TYPES;

        /**
         * Signals the beginning of adding an item to the Accordion.
         *
         * @event beforeItemAdd
         * @param event {Event.Facade} An Event Facade object with the following attribute specific properties added:
         *  <dl>
         *      <dt>item</dt>
         *          <dd>An <code>AccordionItem</code> instance of the item being added</dd>
         *  </dl>
         */
        this.publish( _events.BEFOREITEMADD );
        
        /**
         * Signals an item has been added to the Accordion.
         *
         * @event itemAdded
         * @param event {Event.Facade} An Event Facade object with the following attribute specific properties added:
         *  <dl>
         *      <dt>item</dt>
         *          <dd>An <code>AccordionItem</code> instance of the item that has been added</dd>
         *  </dl>
         */
        this.publish( _events.ITEMADDED );
        
        /**
         * Signals the beginning of removing an item.
         *
         * @event beforeItemRemove
         * @param event {Event.Facade} An Event Facade object with the following attribute specific properties added:
         *  <dl>
         *      <dt>item</dt>
         *          <dd>An <code>AccordionItem</code> instance of the item being removed</dd>
         *  </dl>
         */
        this.publish( _events.BEFOREITEMREMOVE );
        
        /**
         * Signals an item has been removed from Accordion.
         *
         * @event itemRemoved
         * @param event {Event.Facade} An Event Facade object with the following attribute specific properties added:
         *  <dl>
         *      <dt>item</dt>
         *          <dd>An <code>AccordionItem</code> instance of the item that has been removed</dd>
         *  </dl>
         */
        this.publish( _events.ITEMREMOVED );

        /**
         * Signals the beginning of resizing an item.
         *
         * @event beforeItemResized
         * @param event {Event.Facade} An Event Facade object with the following attribute specific properties added:
         *  <dl>
         *      <dt>item</dt>
         *          <dd>An <code>AccordionItem</code> instance of the item being resized</dd>
         *  </dl>
         */
        this.publish( _events.BEFOREITEMERESIZED );
        
        /**
         * Signals an item has been resized.
         *
         * @event itemResized
         * @param event {Event.Facade} An Event Facade object with the following attribute specific properties added:
         *  <dl>
         *      <dt>item</dt>
         *          <dd>An <code>AccordionItem</code> instance of the item that has been resized</dd>
         *  </dl>
         */
        this.publish( _events.ITEMERESIZED );

        /**
         * Signals the beginning of expanding an item
         *
         * @event beforeItemExpand
         * @param event {Event.Facade} An Event Facade object with the following attribute specific properties added:
         *  <dl>
         *      <dt>item</dt>
         *          <dd>An <code>AccordionItem</code> instance of the item being expanded</dd>
         *  </dl>
         */
        this.publish( _events.BEFOREITEMEXPAND );
        
        /**
         * Signals the beginning of collapsing an item
         *
         * @event beforeItemCollapse
         * @param event {Event.Facade} An Event Facade object with the following attribute specific properties added:
         *  <dl>
         *      <dt>item</dt>
         *          <dd>An <code>AccordionItem</code> instance of the item being collapsed</dd>
         *  </dl>
         */
        this.publish( _events.BEFOREITEMCOLLAPSE );
        
        
        /**
         * Signals an item has been expanded
         *
         * @event itemExpanded
         * @param event {Event.Facade} An Event Facade object with the following attribute specific properties added:
         *  <dl>
         *      <dt>item</dt>
         *          <dd>An <code>AccordionItem</code> instance of the item that has been expanded</dd>
         *  </dl>
         */
        this.publish( _events.ITEMEXPANDED );
        
        /**
         * Signals an item has been collapsed
         *
         * @event itemCollapsed
         * @param event {Event.Facade} An Event Facade object with the following attribute specific properties added:
         *  <dl>
         *      <dt>item</dt>
         *          <dd>An <code>AccordionItem</code> instance of the item that has been collapsed</dd>
         *  </dl>
         */
        this.publish( _events.ITEMCOLLAPSED );
        
        /**
         * Signals the beginning of reordering an item
         *
         * @event beforeItemReorder
         * @param event {Event.Facade} An Event Facade object with the following attribute specific properties added:
         *  <dl>
         *      <dt>item</dt>
         *          <dd>An <code>AccordionItem</code> instance of the item being reordered</dd>
         *  </dl>
         */
        this.publish( _events.BEFOREITEMREORDER );
        
        /**
         * Fires before the end of item reordering
         *
         * @event beforeEndItemReorder
         * @param event {Event.Facade} An Event Facade object with the following attribute specific properties added:
         *  <dl>
         *      <dt>item</dt>
         *          <dd>An <code>AccordionItem</code> instance of the item being reordered</dd>
         *  </dl>
         */
        this.publish( _events.BEFOREENDITEMREORDER );
        
        
        /**
         * Signals an item has been reordered
         *
         * @event itemReordered
         * @param event {Event.Facade} An Event Facade object with the following attribute specific properties added:
         *  <dl>
         *      <dt>item</dt>
         *          <dd>An <code>AccordionItem</code> instance of the item that has been reordered</dd>
         *  </dl>
         */
        this.publish( _events.ITEMREORDERED );
    },

    
    /**
     * Collection of items handles.
     * Keeps track of each items's event handle, as returned from <code>Y.on</code> or <code>Y.after</code>.
     * @property _itemHandles
     * @private
     * @type Array
     */
    _itemsHandles: {},
    
    
    /**
     * Removes all handles, attched to given item
     *
     * @method _removeItemHandles
     * @protected
     * @param {Y.AccordionItem} _item The item, which handles to remove
     */
    _removeItemHandles: function( _item ){
        var _itemHandles, _itemHandle;
        
        _itemHandles = this._itemsHandles[ _item ];

        for( _itemHandle in _itemHandles ){
            if( _itemHandles.hasOwnProperty( _itemHandle ) ){
                _itemHandle = _itemHandles[ _itemHandle ];
                _itemHandle.detach();
            }
        }

        delete this._itemsHandles[ _item ];
    },
    
    /**
     * Obtains the precise height of the node provided, including padding and border.
     *
     * @method _getNodeOffsetHeight
     * @protected
     * @param {Node|HTMLElement} p_node The node to gather the height from
     * @return {Number} The calculated height or zero in case of failure
     */
    _getNodeOffsetHeight: function( p_node ){
        var _height, _preciseRegion;

        if( p_node instanceof Node ){
            if( p_node.hasMethod( "getBoundingClientRect" ) ){
                _preciseRegion = p_node.invoke( "getBoundingClientRect" );

                if( _preciseRegion ){
                    _height = _preciseRegion.bottom - _preciseRegion.top;

                    return _height;
                }
            } else {
                _height = p_node.get( "offsetHeight" );
                return Y.Lang.isValue( _height ) ? _height : 0;
            }
        } else if( p_node ){
            _height = p_node.offsetHeight;
            return Y.Lang.isValue( _height ) ? _height : 0;
        }

        return 0;
    },


    /**
     * Updates expand and alwaysVisible properties of given item with the values provided.
     * The properties will be updated only if needed.
     *
     * @method _setItemProperties
     * @protected
     * @param {Y.AccordionItem} _item The item, which properties should be updated
     * @param {boolean} _expanding The new value of "expanded" property
     * @param {boolean} _alwaysVisible The new value of "alwaysVisible" property
     */
    _setItemProperties: function( _item, _expanding, _alwaysVisible ){
        var _curAlwaysVisible, _curExpanded;

        _curAlwaysVisible = _item.get( "alwaysVisible" );
        _curExpanded = _item.get( "expanded" );

        if( _expanding != _curExpanded ){
            _item.set( "expanded", _expanding, {
                internalCall: true
            });
        }

        if( _alwaysVisible !== _curAlwaysVisible ){
            _item.set( "alwaysVisible", _alwaysVisible, {
                internalCall: true
            });
        }
    },

    
    /**
     * Updates user interface of an item and marks it as expanded, alwaysVisible or both
     *
     * @method _setItemUI
     * @protected
     * @param {Y.AccordionItem} _item The item, which user interface should be updated
     * @param {boolean} _expanding If true, the item will be marked as expanded.
     * If false, the item will be marked as collapsed
     * @param {boolean} _alwaysVisible If true, the item will be marked as always visible.
     * If false, the always visible mark will be removed
     */
    _setItemUI: function( _item, _expanding, _alwaysVisible ){
        _item.markAsExpanded( _expanding );
        _item.markAsAlwaysVisible( _alwaysVisible );
    },

    
    /**
     * Distributes the involved items as result of user interaction on item header.
     * Some items might be stored in the list for collapsing, other in the list for expanding. 
     * Finally, invokes <code>_processItems</code> function, except if item has been expanded and
     * user has clicked on always visible icon.
     * If the user clicked on close icon, the item will be closed.
     *
     * @method _onItemChosen
     * @protected
     * @param _item {Y.AccordionItem} The item on which user has clicked or pressed key
     * @param _item {Boolean} True if the user has clicked on always visible icon
     * @param _item {Boolean} True if the user has clicked on close icon
     */
    _onItemChosen: function( _item, _srcIconAlwaysVisible, _srcIconClose ){
        var _toBeExcluded, _alwaysVisible, _expanded, _collapseOthersOnExpand;

        _toBeExcluded = {};        
        _collapseOthersOnExpand = this.get( "collapseOthersOnExpand" );
        _alwaysVisible  = _item.get( "alwaysVisible" );
        _expanded       = _item.get( "expanded" );

        if( _srcIconClose ){
            this.removeItem( _item );
            return;
        } else if( _srcIconAlwaysVisible ){
            if( _expanded ){
                _alwaysVisible = !_alwaysVisible;
                _expanded = _alwaysVisible ? true : _expanded;

                this._setItemProperties( _item, _expanded, _alwaysVisible );
                this._setItemUI( _item, _expanded, _alwaysVisible );

                return;
            } else {
                this._forExpanding[ _item ] = {
                    item: _item,
                    alwaysVisible: true
                };

                if( _collapseOthersOnExpand ){
                    _toBeExcluded[ _item ] = {
                        item: _item
                    };

                    this._storeItemsForCollapsing( _toBeExcluded );
                }
            }
        } else {
            /*
             * Do the opposite
             */
            if( _expanded ){
                this._forCollapsing[ _item ] = {
                    item: _item
                };
            } else {
                this._forExpanding[ _item ] = {
                    item: _item,
                    alwaysVisible: _alwaysVisible
                };

                if( _collapseOthersOnExpand ){
                    _toBeExcluded[ _item ] = {
                        item: _item
                    };

                    this._storeItemsForCollapsing( _toBeExcluded );
                }
            }
        }

        this._processItems();
    },

    
    /**
     * Helper method to adjust the height of all items, which <code>contentHeight</code> property is set as "stretch".
     * If some item has animation running, it will be stopped before running another one.
     * 
     * @method _adjustStretchItems
     * @protected
     * @return {Number} The calculated height per strech item
     */
    _adjustStretchItems: function(){
        var _items = this.get( "items" ), _heightPerStretchItem;

        _heightPerStretchItem = this._getHeightPerStretchItem();
        
        Y.Array.each( _items, function( _item, _index, _items ){
            var _body, _bodyHeight, _anim, _heightSettings, _expanded;

            _heightSettings = _item.get( "contentHeight" );
            _expanded       = _item.get( "expanded" );

            if( _heightSettings.method === "stretch" && _expanded ){
                _anim = this._animations[ _item ];

                // stop waiting animation
                if( _anim ){
                    _anim.stop();
                }

                _body = _item.getStdModNode( WidgetStdMod.BODY );
                _bodyHeight = this._getNodeOffsetHeight( _body );

                if( _heightPerStretchItem < _bodyHeight ){
                    this._processCollapsing( _item, _heightPerStretchItem );
                } else if( _heightPerStretchItem > _bodyHeight ){
                    this._processExpanding( _item, _heightPerStretchItem );
                }
            }
        }, this );

        return _heightPerStretchItem;
    },

    /**
     * Calculates the height per strech item.
     * 
     * @method _getHeightPerStretchItem
     * @protected
     * @return {Number} The calculated height per strech item
     */
    _getHeightPerStretchItem: function(){
        var _height, _items, _stretchCounter = 0;

        _items = this.get( "items" );
        _height = this.get( "boundingBox" ).get( "clientHeight" );

        Y.Array.each( _items, function( _item, _index, _items ){
            var _collapsed, _itemContentHeight, _header, _heightSettings,
                _headerHeight;

            _header = _item.getStdModNode( WidgetStdMod.HEADER );
            _heightSettings = _item.get( "contentHeight" );
            
            _headerHeight = this._getNodeOffsetHeight( _header );

            _height -= _headerHeight;
            _collapsed = !_item.get( "expanded" );

            if( _collapsed ){
                _height -= COLLAPSE_HEIGHT;
                return;
            }

            if( _heightSettings.method === "stretch" ){
                _stretchCounter++;
            } else {
                _itemContentHeight = this._getItemContentHeight( _item );
                _height -= _itemContentHeight;
            }
        }, this );

        if( _stretchCounter > 0 ){
            _height /= _stretchCounter;
        }

        if( _height < 0 ){
            _height = 0;
        }

        return _height;
    },

    
    /**
     * Calculates the height of given item depending on its "contentHeight" property.
     * 
     * @method _getItemContentHeight
     * @protected
     * @param {Y.AccordionItem} The item, which height should be calculated
     * @return {Number} The calculated item's height
     */
    _getItemContentHeight: function( _item ){
        var _heightSettings, _height = 0, _body, _bodyContent;

        _heightSettings = _item.get( "contentHeight" );

        if( _heightSettings.method === "auto" ){
            _body = _item.getStdModNode( WidgetStdMod.BODY );
            _bodyContent = _body.get( "children" ).item(0);
            _height = _bodyContent ? this._getNodeOffsetHeight( _bodyContent ) : 0;
        } else if( _heightSettings.method === "fixed" ) {
            _height = _heightSettings.height;
        } else {
            _height = this._getHeightPerStretchItem();
        }

        return _height;
    },

    
    /**
     * Stores all items, which are expanded and not set as always visible in list
     * in order to be collapsed later.
     * 
     * @method _storeItemsForCollapsing
     * @protected
     * @param {Object} _itemsToBeExcluded (optional) Contains one or more <code>Y.AccordionItem</code> instances,
     * which should be not included in the list
     */
    _storeItemsForCollapsing: function( _itemsToBeExcluded ){
        _itemsToBeExcluded = _itemsToBeExcluded || {};
        var _items = this.get( "items" );

        Y.Array.each( _items, function( _item, _index, _items ){
            var _expanded, _alwaysVisible;

            _expanded = _item.get( "expanded" );
            _alwaysVisible = _item.get( "alwaysVisible" );

            if( _expanded && !_alwaysVisible && !_itemsToBeExcluded[ _item ] ){
                this._forCollapsing[ _item ] = {
                    item: _item
                };
            }
        }, this );
    },

    
    /**
     * Expands an item to given height. This includes also an update to item's user interface
     * 
     * @method _expandItem
     * @protected
     * @param {Y.AccordionItem} _item The item, which should be expanded
     * @param {Number} _height The height to which we should expand the item
     */
    _expandItem: function( _item, _height ){
        var _alwaysVisible = _item.get( "alwaysVisible" );

        this._processExpanding( _item, _height );
        this._setItemUI( _item, true, _alwaysVisible );
    },

    
    /**
     * Expands an item to given height. Depending on the <code>useAnimation</code> setting, 
     * the process of expanding might be animated. This setting will be ignored, if <code>_forceSkipAnimation</code> param
     * is <code>true</code>.
     * 
     * @method _processExpanding
     * @protected
     * @param {Y.AccordionItem} _item An <code>Y.AccordionItem</code> instance to be expanded
     * @param {Boolean} _forceSkipAnimation If true, the animation will be skipped, 
     * without taking in consideration Accordion's <code>useAnimation</code> setting
     * @param {Number} _height The height to which item should be expanded
     */
    _processExpanding: function( _item, _height, _forceSkipAnimation ){
        var _anim, _curAnim, _animSettings, _expanding = false,
            _events = Accordion.EVENT_TYPES,
            _accAnimationSettings, _body;

        
        function _onExpandComplete(){
            delete this._animations[ _item ];
            _anim = null;

            _item.markAsExpanding( false );

            this.fire( _events.ITEMERESIZED, {
                item : _item
            });

            if( _expanding ){
                this.fire( _events.ITEMEXPANDED, {
                    item: _item
                });
            }
        }

        
        _body = _item.getStdModNode( WidgetStdMod.BODY );

        this.fire( _events.BEFOREITEMERESIZED, {
            item: _item
        });

        if( _body.get( "clientHeight" ) <= 0 ){
            _expanding = true;
            this.fire( _events.BEFOREITEMEXPAND, {
                item: _item
            });
        }

        if( !_forceSkipAnimation && this.get( "useAnimation" ) ){
            _animSettings = _item.get( "animation" ) || {};

            _anim = new Anim( {
                node: _body,
                to: {
                    height: _height
                }
            });

            _anim.on( "end", _onExpandComplete, this );

            _accAnimationSettings = this.get( "animation" );

            _anim.set( "duration", _animSettings.duration || _accAnimationSettings.duration );
            _anim.set( "easing"  , _animSettings.easing   || _accAnimationSettings.easing   );
            
            _curAnim = this._animations[ _item ];
            
            if( _curAnim ){
                _curAnim.stop();
            }

            _item.markAsExpanding( true );

            this._animations[ _item ] = _anim;

            _anim.run();
        } else {
            _body.setStyle( "height", _height + "px" );

            this.fire( _events.ITEMERESIZED, {
                item: _item
            });

            if( _expanding ){
                this.fire( _events.ITEMEXPANDED, {
                    item: _item
                });
            }
        }
    },

    
    /**
     * Collapse an item and update its user interface
     * 
     * @method _collapseItem
     * @protected
     * @param {Y.AccordionItem} _item The item, which should be collapsed
     */
    _collapseItem: function( _item ){
        this._processCollapsing( _item, COLLAPSE_HEIGHT );
        this._setItemUI( _item, false, false );
    },

    
    /**
     * Collapse an item to given height. Depending on the <code>useAnimation</code> setting, 
     * the process of collapsing might be animated. This setting will be ignored, if <code>_forceSkipAnimation</code> param
     * is <code>true</code>.
     * 
     * @method _processCollapsing
     * @protected
     * @param {Y.AccordionItem} _item An <code>Y.AccordionItem</code> instance to be collapsed
     * @param {Number} _height The height to which item should be collapsed
     * @param {Boolean} _forceSkipAnimation If true, the animation will be skipped, 
     * without taking in consideration Accordion's <code>useAnimation</code> setting
     */
    _processCollapsing: function( _item, _height, _forceSkipAnimation ){
        var _anim, _curAnim, animSettings, _accAnimationSettings, _events, _body, 
            _collapsing = (_height === COLLAPSE_HEIGHT);
            
        _events = Accordion.EVENT_TYPES;
        _body = _item.getStdModNode( WidgetStdMod.BODY );
        

        function _onCollapseComplete(){
            delete this._animations[ _item ];
            _anim = null;

            _item.markAsCollapsing( false );

            this.fire( _events.ITEMERESIZED, {
                item: _item
            });

            if( _collapsing ){
                this.fire( _events.ITEMCOLLAPSED, {
                    item: _item
                });
            }
        }

        
        this.fire( _events.BEFOREITEMERESIZED, {
            item: _item
        });

        if( _collapsing ){
            this.fire( _events.BEFOREITEMCOLLAPSE, {
                item: _item
            });
        }

        if( !_forceSkipAnimation && this.get( "useAnimation" ) ){
            animSettings = _item.get( "animation" ) || {};

            _anim = new Anim( {
                node: _body,
                to: {
                    height: _height
                }
            });

            _anim.on( "end", _onCollapseComplete, this );

            _accAnimationSettings = this.get( "animation" );

            _anim.set( "duration", animSettings.duration || _accAnimationSettings.duration );
            _anim.set( "easing"  , animSettings.easing   || _accAnimationSettings.easing );

            _curAnim = this._animations[ _item ];
            
            if( _curAnim ){
                _curAnim.stop();
            }
            
            _item.markAsCollapsing( true );

            this._animations[ _item ] = _anim;

            _anim.run();
        } else {
            _body.setStyle( "height", _height + "px" );

            this.fire( _events.ITEMERESIZED, {
                item: _item
            });

            if( _height === 0 ){
                this.fire( _events.ITEMCOLLAPSED, {
                    item: _item
                });
            }
        }
    },

    
    /**
     * Make an item draggable. The item can be reordered later.
     * 
     * @method _initItemDragDrop
     * @protected
     * @param {Y.AccordionItem} _item An <code>Y.AccordionItem</code> instance to be set as draggable
     */
    _initItemDragDrop: function( _item ){
        var _itemHeader, _dd, _bb, _itemBB, _ddrop;

        _itemHeader = _item.getStdModNode( WidgetStdMod.HEADER );

        if( _itemHeader.dd ){
            return;
        }


        _bb = this.get( "boundingBox" );
        _itemBB = _item.get( "boundingBox" );

        _dd = new Y.DD.Drag({
            node: _itemHeader,
            groups: [ Accordion.DRAGGROUP ]
        }).plug(Y.Plugin.DDProxy, {
            moveOnEnd: false
        }).plug(Y.Plugin.DDConstrained, {
            constrain2node: _bb
        });

        _ddrop = new Y.DD.Drop({
            node: _itemBB,
            groups: [ Accordion.DRAGGROUP ]
        });

        _dd.on( "drag:start", function(e){
            var _dragNode, _events, _item;
            
            _item = this.getItem( _dd.get( "node" ).get( "parentNode" ) );
            _events = Accordion.EVENT_TYPES;
            _dragNode = _dd.get( "dragNode" );

            _dragNode.addClass( Accordion.C_PROXY_VISIBLE );
            _dragNode.set( "innerHTML", _item.get( "label" ) );
            
            return this.fire( _events.BEFOREITEMREORDER, { item: _item } );
        }, this );

        _dd.on( "drag:end", function(e){
            var _dragNode, _events, _item;

             _events = Accordion.EVENT_TYPES;
            _dragNode = _dd.get( "dragNode" );

            _dragNode.removeClass( Accordion.C_PROXY_VISIBLE );
            _dragNode.set( "innerHTML", "" );
            
            _item = this.getItem( _dd.get( "node" ).get( "parentNode" ) );
            return this.fire( _events.BEFOREENDITEMREORDER, { item: _item } );
        }, this );
        
        
        _dd.after( "drag:end", function(e){
            var _events, _item, _data;
            
            _events = Accordion.EVENT_TYPES;

            _data = _dd.get( "data" );
            
            if( _data.drophit ){
                _item = this.getItem( _dd.get( "node" ).get( "parentNode" ) );

                _dd.set( "data", {
                    drophit: false
                } );

                return this.fire( _events.ITEMREORDERED, { item: _item } );
            }
            
            return true;
        }, this );


        _dd.on('drag:drophit', function(e) {
            var _mineIndex, _targetItemIndex, _targetItemBB, _itemBB, _cb, 
                _goingUp, _items, _targetItem;

            _targetItem = this.getItem( e.drop.get( "node" ) );

            if( _targetItem === _item ){
                return false;
            }

            _mineIndex = this.getItemIndex( _item );
            _targetItemIndex = this.getItemIndex( _targetItem );
            _targetItemBB = _targetItem.get( "boundingBox" );
            _itemBB = _item.get( "boundingBox" );
            _cb = this.get( "contentBox" );
            _goingUp = false;
            _items = this.get( "items" );

            if( _targetItemIndex < _mineIndex ){
                _goingUp = true;
            }

            _cb.removeChild( _itemBB );

            if( _goingUp ){
                _cb. insertBefore( _itemBB, _targetItemBB );
                _items.splice( _mineIndex, 1 );
                _items.splice( _targetItemIndex, 0, _item );
            } else {
                _cb. insertBefore( _itemBB, _targetItemBB.next( Y.AccordionItem.C_ITEM ) );
                _items.splice( _targetItemIndex + 1, 0, _item );
                _items.splice( _mineIndex, 1 );
            }
            
            _dd.set( "data", {
                drophit: true
            });
            
            return true;
        }, this );

    },

    
    /**
     * Process items as result of user interaction or properties change.
     * This includes four steps:
     * 1. Update the properties of the items
     * 2. Collapse all items stored in the list for collapsing
     * 3. Adjust all stretch items
     * 4. Expand items stored in the list for expanding
     * 
     * @method _processItems
     * @protected
     */
    _processItems: function(){
        var _forCollapsing, _forExpanding, _itemCont, _heightPerStretchItem, 
            _height, _heightSettings, _item;

        _forCollapsing = this._forCollapsing;
        _forExpanding  = this._forExpanding;

        this._setItemsProperties();

        for( _item in _forCollapsing ){
            if( _forCollapsing.hasOwnProperty( _item ) ){
                _itemCont = _forCollapsing[ _item ];

                this._collapseItem( _itemCont.item );
            }
        }

        _heightPerStretchItem = this._adjustStretchItems();

        for( _item in _forExpanding ){
            if( _forExpanding.hasOwnProperty( _item ) ){
                _itemCont = _forExpanding[ _item ];
                _item = _itemCont.item;
                _height = _heightPerStretchItem;
                _heightSettings = _item.get( "contentHeight" );

                if( _heightSettings.method !== "stretch" ){
                    _height = this._getItemContentHeight( _item );
                }

                this._expandItem( _item, _height );
            }
        }

        this._forCollapsing = {};
        this._forExpanding  = {};
    },

    
    /**
     * Update properties of items, which were stored in the lists for collapsing or expanding
     * 
     * @method _setItemsProperties
     * @protected
     */
    _setItemsProperties: function (){
        var _forCollapsing, _forExpanding, _itemData;

        _forCollapsing = this._forCollapsing;
        _forExpanding = this._forExpanding;

        for( _itemData in _forCollapsing ){
            if( _forCollapsing.hasOwnProperty( _itemData ) ){
                _itemData = _forCollapsing[_itemData];
                this._setItemProperties( _itemData.item, false, false );
            }
        }

        for( _itemData in _forExpanding ){
            if( _forExpanding.hasOwnProperty( _itemData ) ){
                _itemData = _forExpanding[_itemData];
                this._setItemProperties( _itemData.item, true, _itemData.alwaysVisible );
            }
        }
    },


    /**
     * Handles the change of "expand" property of given item
     * 
     * @method _afterItemExpand
     * @protected
     * @param {EventFacade} _params The event facade for the attribute change
     */
    _afterItemExpand: function( _params ){
        var _expanded, _item, _alwaysVisible, _collapseOthersOnExpand;

        if( _params.internalCall ){
            return;
        }
        
        _expanded = _params.newVal;
        _item     = _params.currentTarget;
        _alwaysVisible = _item.get( "alwaysVisible" );
        _collapseOthersOnExpand = this.get( "collapseOthersOnExpand" );
        
        if( _expanded ){
            this._forExpanding[ _item ] = {
                item: _item,
                alwaysVisible: _alwaysVisible
            };
            
            if( _collapseOthersOnExpand ){
                this._storeItemsForCollapsing();
            }
        } else {
            this._forCollapsing[ _item ] = {
                item: _item
            };
        }
        
        this._processItems();
    },

    /**
     * Handles the change of "alwaysVisible" property of given item
     * 
     * @method _afterItemAlwaysVisible
     * @protected
     * @param {EventFacade} _params The event facade for the attribute change
     */
    _afterItemAlwaysVisible: function( _params ){
        var _item, _alwaysVisible, _expanded;
        
        if( _params.internalCall ){
            return;
        }

        _alwaysVisible = _params.newVal;
        _item          = _params.currentTarget;
        _expanded      = _item.get( "expanded" );

        if( _alwaysVisible ){
            if( _expanded ){
                this._setItemProperties( _item, true, true );
                this._setItemUI( _item, true, true );
                return;
            } else {
                this._forExpanding[ _item ] = {
                    item: _item,
                    alwaysVisible: true
                };

                this._storeItemsForCollapsing();
            }
        } else {
            if( _expanded ){
                this._setItemUI( _item, true, false );
                return;
            } else {
                return;
            }
        }
        
        this._processItems();
    },
    
    
    /**
     * Handles the change of "contentHeight" property of given item
     * 
     * @method _afterContentHeight
     * @protected
     * @param {EventFacade} _params The event facade for the attribute change
     */
    _afterContentHeight: function( _params ){
        var _item, _itemContentHeight, _body, _bodyHeight, _expanded;
        
        _item = _params.currentTarget;
        
        this._adjustStretchItems();
        
        if( _params.newVal.method !== "stretch" ){
            _expanded = _item.get( "expanded" );
            _itemContentHeight = this._getItemContentHeight( _item );
            
            _body = _item.getStdModNode( WidgetStdMod.BODY );
            _bodyHeight = this._getNodeOffsetHeight( _body );
            
            if( _itemContentHeight < _bodyHeight ){
                this._processCollapsing( _item, _itemContentHeight, !_expanded );
            } else if( _itemContentHeight > _bodyHeight ){
                this._processExpanding( _item, _itemContentHeight, !_expanded );
            }
        }
    },
    
    
    
    /**
     * Subscribe for resize event, which could be provided from the browser or from an arbitrary object.
     * For example, if there is LayoutManager in the page, it is preferable to subscribe to its resize event,
     * instead to those, which browser provides.
     * 
     * @method _setUpResizing
     * @protected
     * @param {String|Object} String "default" or object with the following properties:
     *  <dl>
     *      <dt>sourceObject</dt>
     *          <dd>An abbitrary object</dd>
     *      <dt>resizeEvent</dt>
     *          <dd>The name of its resize event</dd>
     *  </dl>
     */
    _setUpResizing: function( _value ){
        if( this._resizeEventHandle ){
            this._resizeEventHandle.detach();
        }

        if( _value === "default" ){
            this._resizeEventHandle = Y.on( 'windowresize', this._adjustStretchItems, this );
        } else {
            this._resizeEventHandle = _value.sourceObject.on( _value.resizeEvent, this._adjustStretchItems, this );
        }
    },

    
    /**
     * Creates one or more items found in Accordion's <code>contentBox</code>
     * 
     * @method renderUI
     * @protected
     */
    renderUI: function(){
        var _cb, _itemsDom;

        _cb = this.get( "contentBox" );
        _itemsDom = _cb.queryAll( "> div." + Y.AccordionItem.C_ITEM );

        _itemsDom.each( function( _itemNode, _index, _itemsDom ){
            var _newItem;

            if( !this.getItem( _itemNode ) ){
                _newItem = new Y.AccordionItem({
                    contentBox: _itemNode
                });

                this.addItem( _newItem );
            }
        }, this );
    },

    
    /**
     * Add listener to <code>itemChosen</code> and <code>keypress</code> events in Accordion's content box
     * 
     * @method bindUI
     * @protected
     */
    bindUI: function(){
        var _contentBox, _itemChosenEvent, _header, _itemNode, _item, _iconAlwaysVisible,
            _iconClose, _srcIconAlwaysVisible, _srcIconExtended, _srcIconClose, _iconExtended;

        _contentBox = this.get( 'contentBox' );
        _itemChosenEvent = this.get( 'itemChosen' );
        
        _contentBox.delegate( _itemChosenEvent, function(e){
            _header = e.currentTarget;
            _itemNode = _header.get( "parentNode" );
            _item = this.getItem( _itemNode );
            _iconAlwaysVisible = _item.get( "iconAlwaysVisible" );
            _iconClose = _item.get( "iconClose" );
            _srcIconAlwaysVisible = (_iconAlwaysVisible === e.target);
            _srcIconClose = (_iconClose === e.target);

            this._onItemChosen( _item, _srcIconAlwaysVisible, _srcIconClose );
        }, 'div.yui-widget-hd', this );


        _contentBox.delegate( "keypress", function(e){
            var _charCode, _target = e.target;
            
            _charCode = e.charCode;

            if( _charCode === 13 ){
                _header = e.currentTarget;
                _itemNode = _header.get( "parentNode" );
                _item = this.getItem( _itemNode );

                _iconAlwaysVisible = _item.get( "iconAlwaysVisible" );
                _iconExtended = _item.get( "iconExtended" );
                _iconClose = _item.get( "iconClose" );
                _srcIconAlwaysVisible = (_iconAlwaysVisible === _target);
                _srcIconExtended = (_iconExtended === _target );
                _srcIconClose = (_iconClose === e.target);

                /**
                 * Exclude label in order to avoid double function invocation.
                 * Label keypress will be managed in "click" listener.
                 */
                if( _srcIconExtended || _srcIconAlwaysVisible  || _srcIconClose ){
                    this._onItemChosen( _item, _srcIconAlwaysVisible, _srcIconClose );
                }
            }
        }, 'div.yui-widget-hd', this );
    },

    
    /**
     * Add an item to Accordion. Items could be added/removed multiple times and they
     * will be rendered in the process of adding, if not.
     * The item will be expanded, collapsed, or set as always visible depending on the 
     * settings. Item's properties will be also updated, if they are incomplete.
     * For example, if <code>alwaysVisible</code> is true, but <code>expanded</code>
     * property is false, it will be set to true also.
     * 
     * If the second param, <code>_parentItem</code> is an <code>Y.AccordionItem</code> instance,
     * registered in Accordion, the item will be added as child of the <code>_parentItem</code>
     * 
     * @method addItem
     * @param {Y.AccordionItem} _item The item to be added in Accordion
     * @param {Y.AccordionItem} _parentItem (optional) This item will be the parent of the item being added
     * 
     * @return Boolean True in case of successfully added item, false otherwise
     */
    addItem: function( _item, _parentItem ){
        
        function _addItem( _item ){
            var _expanded, _alwaysVisible;
            
            _expanded = _item.get( "expanded" );
            _alwaysVisible = _item.get( "alwaysVisible" );

            _expanded = _expanded || _alwaysVisible;

            if( _expanded ){
                this._forExpanding[ _item ] = {
                    item: _item,
                    alwaysVisible: _alwaysVisible
                };
            } else {
                this._forCollapsing[ _item ] = {
                    item: _item
                };
            }

            this._processItems();
        }

        var _bodyContent, _itemIndex, _items, _contentBox, _itemHandles,
        _itemContentBox, _events, _res, _cb, _children, _itemBoundingBox;

        _events = Accordion.EVENT_TYPES;

        _res = this.fire( _events.BEFOREITEMADD, {
            item: _item
        });

        if( !_res ){
            return false;
        }

        _items = this.get( "items" );
        _contentBox = this.get( 'contentBox' );

        _itemContentBox   = _item.get( 'contentBox' );
        _itemBoundingBox  = _item.get( 'boundingBox' );

        if( !_itemContentBox.inDoc() ){
            if( _parentItem ){
                _itemIndex = this.getItemIndex( _parentItem );

                if( _itemIndex < 0 ){
                    return false;
                }

                _items.splice( _itemIndex, 0, _item );

                if( _item.get( "rendered" ) ){
                    _contentBox.insertBefore( _itemBoundingBox, _parentItem.get( 'boundingBox' ) );
                } else {
                    _contentBox.insertBefore( _itemContentBox, _parentItem.get( 'boundingBox' ) );
                }
            } else {
                _items.push( _item );

                if( _item.get( "rendered" ) ){
                    _contentBox.insertBefore( _itemBoundingBox, null );
                } else {
                    _contentBox.insertBefore( _itemContentBox, null );
                }
            }
        } else {
            _cb = this.get( "contentBox" );
            _children = _cb.get( "children" );

            _res = _children.some( function( _node, _index, _nodeList ){
                if( _node === _itemContentBox ){
                    _items.splice( _index, 0, _item );
                    return true;
                } else {
                    return false;
                }
            }, this );

            if( !_res ){
                return false;
            }
        }

        _bodyContent = _item.get( "bodyContent" );

        if( !_bodyContent ){
            _item.set( "bodyContent", "&nbsp;" );
        }

        if( !_item.get( "rendered" ) ){
            _item.render();
        }
        
        _addItem.call( this, _item );

        if( this.get( "reorderItems" ) ){
            this._initItemDragDrop( _item );
        }
        
        _itemHandles = this._itemsHandles[ _item ];
        
        if( !_itemHandles ){
            _itemHandles = {};
        }
        
        _itemHandles = {
            "expandedChange" : _item.after( "expandedChange", this._afterItemExpand, this ),
            "alwaysVisibleChange" : _item.after( "alwaysVisibleChange", this._afterItemAlwaysVisible, this ),
            "contentHeightChange" : _item.after( "contentHeightChange", this._afterContentHeight, this )
        };
        
        this._itemsHandles[ _item ] = _itemHandles;

        this.fire( _events.ITEMADDED, {
            item: _item
        });

        return true;
    },

    
    /**
     * Removes an previously registered item in Accordion
     * 
     * @method removeItem
     * @param {Y.AccordionItem|Number} p_item The item to be removed, or its index
     * @return Y.AccordionItem The removed item or null if not found
     */
    removeItem: function( p_item ){
        var _items, _bb, _item = null, _itemIndex, _events;
        
         _events = Accordion.EVENT_TYPES;
        
        _items = this.get( "items" );
        
        if( Lang.isNumber( p_item ) ){
            _itemIndex = p_item;
        } else if( p_item instanceof Y.AccordionItem ){
            _itemIndex = this.getItemIndex( p_item );
        } else {
            return null;
        }

        if( _itemIndex >= 0 ){
            
            this.fire( _events.BEFOREITEMREMOVE, {
                item: p_item
            });

            _item = _items.splice( _itemIndex, 1 )[0];

            this._removeItemHandles( _item );
            
            _bb = _item.get( "boundingBox" );
            _bb.remove();

            this._adjustStretchItems();
            
            this.fire( _events.ITEMREMOVED, {
                item: p_item
            });
        }

        return _item;
    },

    
    /**
     * Searching for item, previously registered in Accordion
     * 
     * @method getItem
     * @param {Number|Y.Node} _param If number, this must be item's index.
     * If Node, it should be the value of item's <code>contentBox</code> or <code>boundingBox</code> properties
     * 
     * @return Y.AccordionItem The found item or null
     */
    getItem: function( _param ){
        var _items = this.get( "items" ), _item = null;

        if( Lang.isNumber( _param ) ){
            _item = _items[ _param ];

            return (_item instanceof Y.AccordionItem) ? _item : null;
        } else if( _param instanceof Node ){

            Y.Array.some( _items, function( _tmpItem, _index, _items ){
                var _contentBox, _boundingBox;
                
                _contentBox = _tmpItem.get( "contentBox" );
                _boundingBox = _tmpItem.get( "boundingBox" );

                if( _contentBox === _param ){
                    _item = _tmpItem;
                    return true;
                } else if( _boundingBox === _param ){
                    _item = _tmpItem;
                    return true;
                } else {
                    return false;
                }
            }, this );
        }

        return _item;
    },

    
    /**
     * Looking for the index of previously registered item
     * 
     * @method getItemIndex
     * @param {Y.AccordionItem} _item The item which index should be returned
     * @return Number Item index or <code>-1</code> if item has been not found
     */
    getItemIndex: function( _item ){
        var _res = -1, _items;

        if( _item instanceof Y.AccordionItem ){
            _items = this.get( "items" );

            Y.Array.some( _items, function( _tmpItem, _index, _items ){
                if( _tmpItem === _item ){
                    _res = _index;
                    return true;
                } else {
                    return false;
                }
            }, this );
        }

        return _res;
    }
    
});

Y.Accordion = Accordion;

}());

/**
 * Provides the Accordion class
 *
 * @module accordion
 */

(function(){

/**
 * Create an AccordionItem widget.
 * 
 * @param _config {Object} Object literal specifying AccordionItem configuration properties.
 *
 * @class AccordionItem
 * @constructor
 * @extends Widget
 */

function AccordionItem( _config ){
    AccordionItem.superclass.constructor.apply( this, arguments );
}

// Local constants
var Lang = Y.Lang,
    Base = Y.Base,
    Node = Y.Node,
    WidgetStdMod = Y.WidgetStdMod,
    AccItemName = "accordion-item",
    getCN = Y.ClassNameManager.getClassName;

/**
 *  Static property provides a string to identify the class.
 *
 * @property AccordionItem.NAME
 * @type String
 * @static
 */
AccordionItem.NAME = AccItemName;

/**
 * Static property used to define the default attribute 
 * configuration for the Accordion.
 * 
 * @property Accordion.ATTRS
 * @type Object
 * @static
 */
AccordionItem.ATTRS = {
    /**
     * @description The icon of the item. The value can be one of these:
     *  <dl>
     *      <dt>default</dt>
     *          <dd>The AccordionItem will use the default icon</dd>
     *      <dt>Custom class name</dt>
     *          <dd>A custom class to be added to icon's classes</dd>
     *  </dl>
     *
     * @attribute icon
     * @default "default"
     * @type String
     */
    icon: {
        value: "default",
        validator: Lang.isString
    },

    /**
     * @description The label of the item
     *
     * @attribute label
     * @default "&#160;"
     * @type String
     */
    label: {
        value: "&#160;",
        validator: Lang.isString
    },
    
    /**
     * @description Icon always visible
     *
     * @attribute iconAlwaysVisible
     * @default null
     * @readOnly
     * @type Node
     */
    iconAlwaysVisible: {
        value: null,
        validator: function( _value ){
            return _value instanceof Node;
        },
        getter: function(){
            return this._iconAlwaysVisible;
        },
        readOnly: true
    },
    
    /**
     * @description Icon extended
     *
     * @attribute iconExtended
     * @default null
     * @readOnly
     * @type Node
     */
    iconExtended: {
        value: null,
        validator: function( _value ){
            return _value instanceof Node;
        },
        getter: function(){
            return this._iconExtended;
        },
        readOnly: true
    },


    /**
     * @description Icon close, or null if the item is not closable
     *
     * @attribute iconClose
     * @default null
     * @readOnly
     * @type Node
     */
    iconClose: {
        value: null,
        validator: function( _value ){
            return _value instanceof Node;
        },
        getter: function(){
            return this._iconClose;
        }
    },

    /**
     * @description Get/Set the expanded status of the item
     *
     * @attribute expanded
     * @default false
     * @type Boolean
     */
    expanded: {
        value: false,
        validator: Lang.isBoolean
    },

    /**
     * @description Describe the method, which will be used when expanding/collapsing
     * the item. The value should be an object with at least one property ("method"):
     *  <dl>
     *      <dt>method</dt>
     *          <dd>The method can be one of these: "auto", "fixed" and "stretch"</dd>
     *      <dt>height</dt>
     *          <dd>Must be set only if method's value is "fixed"</dd>
     *  </dl>
     *
     * @attribute contentHeight
     * @default auto
     * @type Object
     */
    contentHeight: {
        value: {
            method: "auto"
        },
        validator: function( _value ){
            if( Lang.isObject( _value ) ){
                if( _value.method === "auto" ){
                    return true;
                } else if( _value.method === "stretch" ){
                    return true;
                } else if( _value.method === "fixed" && Lang.isNumber( _value.height ) && 
                    _value.height >= 0 ){
                    return true;
                }
            }
            
            return false;
        }
    },

    /**
     * @description Get/Set the expanded status of the item
     *
     * @attribute alwaysVisible
     * @default false
     * @type Boolean
     */
    alwaysVisible: {
        value: false,
        validator: Lang.isBoolean
    },
    
    
    /**
     * @description Get/Set the animaton specific settings. By default there are no any settings.
     * If set, they will overwrite Accordion's animation settings
     *
     * @attribute animation
     * @default {}
     * @type Object
     */
    animation: {
        value: {},
        validator: Lang.isObject
    },

    /**
     * @description Provides client side string localization support.
     *
     * @attribute strings
     * @default Object English messages
     * @type Object
     */
    strings: {
        value: {
            title_always_visible_off: "Click to set always visible on",
            title_always_visible_on: "Click to set always visible off",
            title_iconextended_off: "Click to expand",
            title_iconextended_on: "Click to collapse",
            title_iconclose: "Click to close"
        }
    },

    /**
     * @description Flag, indicated whether the item can be closed by user, or not
     * If yes, there will be placed close icon, otherwise not
     *
     * @attribute closable
     * @default false
     * @type Boolean
     */
    closable: {
        value: false,
        validator: Lang.isBoolean
    }
};


// AccordionItem classes
AccordionItem.C_ITEM                         = getCN( AccItemName );
AccordionItem.DEFAULT_ICON                   = "default";

AccordionItem.C_TABLE                        = getCN( AccItemName, "table" );
AccordionItem.C_TD_ICON                      = getCN( AccItemName, "td", "icon" );
AccordionItem.C_TD_LABEL                     = getCN( AccItemName, "td", "label" );

AccordionItem.C_TD_ICONALWAYSVISIBLE         = getCN( AccItemName, "td", "iconalwaysvisible" );
AccordionItem.C_TD_ICONEXTENDED              = getCN( AccItemName, "td", "iconextended" );
AccordionItem.C_TD_ICONCLOSE                 = getCN( AccItemName, "td", "iconclose" );
AccordionItem.C_TD_ICONCLOSE_HIDDEN          = getCN( AccItemName, "td", "iconclose", "hidden" );

AccordionItem.C_ICONEXTENDED_EXPANDING       = getCN( AccItemName, "iconextended", "expanding" );
AccordionItem.C_ICONEXTENDED_COLLAPSING      = getCN( AccItemName, "iconextended", "collapsing" );

AccordionItem.C_ICON                         = getCN( AccItemName, "icon" );
AccordionItem.C_LABEL                        = getCN( AccItemName, "label" );
AccordionItem.C_ICONALWAYSVISIBLE            = getCN( AccItemName, "iconalwaysvisible" );
AccordionItem.C_ICONEXTENDED                 = getCN( AccItemName, "iconextended" );
AccordionItem.C_ICONCLOSE                    = getCN( AccItemName, "iconclose" );

AccordionItem.C_EXPANDED                     =  getCN( AccItemName, "expanded" );
AccordionItem.C_CLOSABLE                     =  getCN( AccItemName, "closable" );
AccordionItem.C_ALWAYSVISIBLE                =  getCN( AccItemName, "alwaysvisible" );
AccordionItem.C_CONTENTHEIGHT                =  getCN( AccItemName, "contentheight" );

AccordionItem.C_ICONEXTENDED_ON              = getCN( AccItemName, "iconextended", "on" );
AccordionItem.C_ICONEXTENDED_OFF             = getCN( AccItemName, "iconextended", "off" );

AccordionItem.C_ICONALWAYSVISIBLE_ON         = getCN( AccItemName, "iconalwaysvisible", "on" );
AccordionItem.C_ICONALWAYSVISIBLE_OFF        = getCN( AccItemName, "iconalwaysvisible", "off" );


/**
 * Static Object hash used to capture existing markup for progressive
 * enhancement.  Keys correspond to config attribute names and values
 * are selectors used to inspect the contentBox for an existing node
 * structure.
 *
 * @property AccordionItem.HTML_PARSER
 * @type Object
 * @protected
 * @static
 */
AccordionItem.HTML_PARSER = {

    label: function ( contentBox ){
        var _node, _class;
        
        _class = "> .yui-widget-hd > div." + AccordionItem.C_LABEL;
        _node = contentBox.query( _class );

        return (_node) ? _node.get( "innerHTML" ) : null;
    },

    icon: function ( contentBox ){
        var _node, _class;
        
        _class = "> .yui-widget-hd > div." + AccordionItem.C_ICON;
        _node = contentBox.query( _class );

        if( _node ){
            _class = _node.get( "className" );

            if( _class && Lang.isString( _class ) ){
                return _class;
            }
        }

        return null;
    },

    iconClose: function( contentBox ){
        var _node, _class;

        _class = "> .yui-widget-hd > div." + AccordionItem.C_ICONCLOSE;
        _node = contentBox.query( _class );

        if( _node ){
            _class = _node.get( "className" );

            if( _class && Lang.isString( _class ) ){
                return _class;
            }
        }

        return null;
    },

    expanded: function( contentBox ){
        var _expanded;

        _expanded = contentBox.hasClass( AccordionItem.C_EXPANDED );

        return _expanded;
    },

    alwaysVisible: function( contentBox ){
        var _alwaysVisible;

        _alwaysVisible = contentBox.hasClass( AccordionItem.C_ALWAYSVISIBLE );

        return _alwaysVisible;
    },

    closable: function( contentBox ){
        var _closable;

        _closable = contentBox.hasClass( AccordionItem.C_CLOSABLE );

        return _closable;
    },

    contentHeight: function( contentBox ){
        var _class, _classValue, _height = 0, i, _length, _index, _char;

        _classValue = contentBox.get( "className" );

        _class = AccordionItem.C_CONTENTHEIGHT + '-';

        _index = _classValue.indexOf( _class, 0);

        if( _index >= 0 ){
            _length = _classValue.length;
            _index += _class.length;

            _classValue = _classValue.substring( _index );

            if( _classValue.match( /^auto\s*/g ) ){
                return {
                    method: "auto"
                };
            } else if( _classValue.match( /^stretch\s*/g ) ){
                return {
                    method: "stretch"
                };
            } else if( _classValue.match( /^fixed-\d+/g )  ){
                for( i = 6, _length = _classValue.length; i < _length; i++ ){ // 6 = "fixed-".length
                    _char = _classValue.charAt(i);
                    _char = parseInt( _char, 10 );

                    if( Lang.isNumber( _char ) ){
                        _height = (_height * 10) + _char;
                    } else {
                        break;
                    }
                }

                return {
                    method: "fixed",
                    height: _height
                };
            }
        }

        return null;
    }
};


// AccordionItem extends Widget

Y.extend( AccordionItem, Y.Widget, {

    /**
     * Creates the header content of an AccordionItem
     *
     * @method _createHeader
     * @protected
     */
    _createHeader: function(){
        var _strings, _html, _node, _closable;

        function _setIcon(){
            var _icon = this.get( "icon" );

            if( _icon === AccordionItem.DEFAULT_ICON ){
                return AccordionItem.C_ICON;
            } else {
                return _icon;
            }
        }

        _strings = this.get( "strings" );
        _closable = this.get( "closable" );

        _html = [
            "<TABLE selectable='no' class='", AccordionItem.C_TABLE, "'>",
            "<TBODY>",
            "<TR>",
                "<TD class='", AccordionItem.C_TD_ICON, "'", " id='", Y.guid(), "'>",
                    "<div id='", Y.guid(), "' class='", _setIcon.call(this), "' align='middle' ", "/>",
                "</TD>",
                "<TD class='" , AccordionItem.C_TD_LABEL, "'>" ,
                    "<div class='" , AccordionItem.C_LABEL, "'" ,
                       " id='", Y.guid(), "' ", ">",
                       "<a href='#'>", this.get( "label" ), "</a>",
                    "</div>",
                "</TD>",
                "<TD class='", AccordionItem.C_TD_ICONALWAYSVISIBLE, "'", ">" ,
                    "<div tabindex='0' class='",
                        AccordionItem.C_ICONALWAYSVISIBLE, " " , AccordionItem.C_ICONALWAYSVISIBLE_OFF , "'",
                        " title='", _strings.title_always_visible_off, "'",
                        " id='", Y.guid(), "'>",
                    "</div>",                    
                "</TD>",
                "<TD class='" , AccordionItem.C_TD_ICONEXTENDED, "'>" ,
                    "<div tabindex='0' class='" , AccordionItem.C_ICONEXTENDED, " ", AccordionItem.C_ICONEXTENDED_OFF, "'",
                        " title='", _strings.title_iconextended_off, "'",
                        " id='", Y.guid(), "'>",
                    "</div>",
                "</TD>",
                "<TD class='" , AccordionItem.C_TD_ICONCLOSE, " ", (!_closable ? AccordionItem.C_TD_ICONCLOSE_HIDDEN : ""), "'>" ,
                    "<div tabindex='0' class='" , AccordionItem.C_ICONCLOSE, "'",
                        " title='", _strings.title_iconclose, "'",
                        " id='", Y.guid(), "'>",
                    "</div>",
                "</TD>",
            "</TR>",
            "</TBODY>",
            "</TABLE>"
        ].join( '' );

        _node = Node.create( _html );
        this.set( "headerContent", _node );
    },


    /**
     * Handles the change of "iconChanged" property. Set custom or default class for the icon
     * 
     * @method _iconChanged
     * @protected
     * @param {EventFacade} _params The event facade for the attribute change
     */
    _iconChanged: function( _params ){
        var _icon;

        _icon = _params.newVal;

        if( this.get( "rendered" ) ){
            if( _icon === AccordionItem.DEFAULT_ICON ){
                this._icon.set( "className", AccordionItem.C_ICON );
            } else {
                this._icon.addClass( _icon );
            }
        }
    },

    
    /**
     * Handles the change of "labelChanged" property. Updates item's UI with the label provided
     * 
     * @method _labelChanged
     * @protected
     * @param {EventFacade} _params The event facade for the attribute change
     */
    _labelChanged: function( _params ){
        if( this.get( "rendered" ) ){
            this._label.set( "innerHTML", ["<a href='#'>", _params.newVal, "</a>" ].join('') );
        }
    },


    /**
     * Handles the change of "closableChanged" property. Hides or shows close icon
     *
     * @method _closableChanged
     * @protected
     * @param {EventFacade} _params The event facade for the attribute change
     */
    _closableChanged: function( _params ){
        var _class, _node, _contentBox;

        if( this.get( "rendered" ) ){
            _contentBox = this.get( 'contentBox' );
        
            _class = "> .yui-widget-hd ." + AccordionItem.C_TD_ICONCLOSE;
            _node = _contentBox.query( _class );

            if( _params.newVal ){
                _node.removeClass( AccordionItem.C_TD_ICONCLOSE_HIDDEN );
            } else {
                _node.addClass( AccordionItem.C_TD_ICONCLOSE_HIDDEN );
            }
        }
    },


    /**
     * Initializer lifecycle implementation for the AccordionItem class.
     *
     * @method initializer
     * @protected
     * @param  _config {Object} Configuration object literal for the AccordionItem
     */
    initializer: function( _config ) {
        this.after( 'render', function(e){
            var _contentBox = this.get( 'contentBox' );

            this._icon = _contentBox.query( "." + AccordionItem.C_ICON );
            this._label = _contentBox.query( "." + AccordionItem.C_LABEL );
            this._iconAlwaysVisible = _contentBox.query( "." + AccordionItem.C_ICONALWAYSVISIBLE );
            this._iconExtended = _contentBox.query( "." + AccordionItem.C_ICONEXTENDED );
            this._iconClose = _contentBox.query( "." + AccordionItem.C_ICONCLOSE );
        }, this );

        this.after( "iconChange",     this._iconChanged,     this );
        this.after( "labelChange",    this._labelChanged,    this );
        this.after( "closableChange", this._closableChanged, this );
    },

    
    /**
     * Destructor lifecycle implementation for the AccordionItem class.
     *
     * @method destructor
     * @protected
     */
    destructor : function() {
        // EMPTY
    },

    
    /**
     * Creates AccordionItem's header.
     * 
     * @method renderUI
     * @protected
     */
    renderUI: function(){
        this._createHeader();
    },
    
   /**
    * Marks the item as always visible by adding class to always visible icon.
    * The icon will be updated only if needed.
    * 
    * @method markAsAlwaysVisible
    * @param {Boolean} _alwaysVisible Whether or not the item should be marked as always visible
    * @return Boolean Return true if the icon has been updated, false if there was no need to update
    */
    markAsAlwaysVisible: function( _alwaysVisible ){
        var _strings = this.get( "strings" );

        if( _alwaysVisible ){
            if( !this._iconAlwaysVisible.hasClass( AccordionItem.C_ICONALWAYSVISIBLE_ON ) ){
                this._iconAlwaysVisible.replaceClass( AccordionItem.C_ICONALWAYSVISIBLE_OFF, AccordionItem.C_ICONALWAYSVISIBLE_ON );
                this._iconAlwaysVisible.set( "title", _strings.title_always_visible_on );
                return true;
            }
        } else {
            if( this._iconAlwaysVisible.hasClass( AccordionItem.C_ICONALWAYSVISIBLE_ON ) ){
                this._iconAlwaysVisible.replaceClass( AccordionItem.C_ICONALWAYSVISIBLE_ON, AccordionItem.C_ICONALWAYSVISIBLE_OFF );
                this._iconAlwaysVisible.set( "title", _strings.title_always_visible_off );
                return true;
            }
        }
        
        return false;
    },

    
    /**
    * Marks the item as expanded by adding class to expand icon.
    * The icon will be updated only if needed.
    * 
    * @method markAsExpanded
    * @param {Boolean} _expanded Whether or not the item should be marked as expanded
    * @return Boolean Return true if the icon has been updated, false if there was no need to update
    */
    markAsExpanded: function( _expanded ){
        var _strings = this.get( "strings" );

        if( _expanded ){
            if( !this._iconExtended.hasClass( AccordionItem.C_ICONEXTENDED_ON ) ){
                this._iconExtended.replaceClass( AccordionItem.C_ICONEXTENDED_OFF, AccordionItem.C_ICONEXTENDED_ON );
                this._iconExtended.set( "title" , _strings.title_iconextended_on );
                return true;
            }
        } else {
            if( this._iconExtended.hasClass( AccordionItem.C_ICONEXTENDED_ON ) ){
                this._iconExtended.replaceClass( AccordionItem.C_ICONEXTENDED_ON, AccordionItem.C_ICONEXTENDED_OFF );
                this._iconExtended.set( "title" , _strings.title_iconextended_off );
                return true;
            }
        }
        
        return false;
    },

   
   /**
    * Marks the item as expanding by adding class to expand icon.
    * The method will update icon only if needed.
    * 
    * @method markAsExpanding
    * @param {Boolean} _expanding Whether or not the item should be marked as expanding
    * @return Boolean Return true if the icon has been updated, false if there was no need to update
    */
    markAsExpanding: function( _expanding ){
        if( _expanding ){
            if( !this._iconExtended.hasClass( AccordionItem.C_ICONEXTENDED_EXPANDING ) ){
                this._iconExtended.addClass( AccordionItem.C_ICONEXTENDED_EXPANDING );
                return true;
            }
        } else {
            if( this._iconExtended.hasClass( AccordionItem.C_ICONEXTENDED_EXPANDING ) ){
                this._iconExtended.removeClass( AccordionItem.C_ICONEXTENDED_EXPANDING );
                return true;
            }
        }
        
        return false;
    },

    
   /**
    * Marks the item as collapsing by adding class to expand icon.
    * The method will update icon only if needed.
    * 
    * @method markAsCollapsing
    * @param {Boolean} _collapsing Whether or not the item should be marked as collapsing
    * @return Boolean Return true if the icon has been updated, false if there was no need to update
    */
    markAsCollapsing: function( _collapsing ){
        if( _collapsing ){
            if( !this._iconExtended.hasClass( AccordionItem.C_ICONEXTENDED_COLLAPSING ) ){
                this._iconExtended.addClass( AccordionItem.C_ICONEXTENDED_COLLAPSING );
                return true;
            }
        } else {
            if( this._iconExtended.hasClass( AccordionItem.C_ICONEXTENDED_COLLAPSING ) ){
                this._iconExtended.removeClass( AccordionItem.C_ICONEXTENDED_COLLAPSING );
                return true;
            }
        }
        
        return false;
    }
    
});

// Add WidgetStdMod's functionality to AccordionItem
Base.build( AccordionItem.NAME, AccordionItem, [ WidgetStdMod ], {
    dynamic: false
});

Y.AccordionItem = AccordionItem;

}());



}, '1.01' ,{requires:['widget-stdmod', 'event', 'anim-easing', 'dd-constrain', 'dd-proxy', 'dd-drop']});
